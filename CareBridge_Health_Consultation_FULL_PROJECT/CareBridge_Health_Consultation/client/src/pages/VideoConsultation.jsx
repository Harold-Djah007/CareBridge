import React, { useEffect, useRef, useState } from "react";
import { Video, VideoOff, Mic, MicOff, PhoneOff, MonitorUp, ShieldCheck } from "lucide-react";
import { io } from "socket.io-client";
import { useSearchParams } from "react-router-dom";
import { useAuth, useToast } from "../main";
import { api, socketUrl } from "../api";
import { roomIdFor } from "../utils";

export default function VideoConsultation() {
  const { user } = useAuth();
  const { push } = useToast();
  const [params] = useSearchParams();
  const localRef = useRef();
  const remoteRef = useRef();
  const pcRef = useRef();
  const streamRef = useRef();
  const socketRef = useRef();
  const [peer, setPeer] = useState(null);
  const [joined, setJoined] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState("Ready to join");

  useEffect(() => {
    api(`/contacts?userId=${user.id}&role=${user.role}`).then((list) => {
      const wanted = params.get("with");
      setPeer(list.find((c) => c.id === wanted) || list[0] || null);
    });
    return () => stop();
  }, [user.id]);

  const otherId = peer?.id || (user.role === "patient" ? "d1" : "p1");
  const roomId = roomIdFor(user.id, otherId);

  const initPeer = () => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.onicecandidate = (e) => e.candidate && socketRef.current.emit("webrtc-ice", { roomId, candidate: e.candidate });
    pc.ontrack = (e) => { remoteRef.current.srcObject = e.streams[0]; setStatus("Connected"); };
    streamRef.current?.getTracks().forEach((t) => pc.addTrack(t, streamRef.current));
    pcRef.current = pc;
    return pc;
  };

  const join = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      const socket = io(socketUrl, { autoConnect: true });
      socketRef.current = socket;
      socket.emit("join-room", roomId);
      let pc = initPeer();
      socket.on("webrtc-offer", async ({ offer }) => {
        if (!pcRef.current) pc = initPeer();
        await pcRef.current.setRemoteDescription(offer);
        const ans = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(ans);
        socket.emit("webrtc-answer", { roomId, answer: ans });
      });
      socket.on("webrtc-answer", async ({ answer }) => { await pcRef.current?.setRemoteDescription(answer); });
      socket.on("webrtc-ice", async ({ candidate }) => { try { await pcRef.current?.addIceCandidate(candidate); } catch {} });
      setJoined(true);
      setStatus("Waiting for the other participant");
      if (user.role === "doctor" || user.role === "admin") {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc-offer", { roomId, offer });
      }
    } catch {
      setStatus("Camera or microphone permission was not granted.");
      push("Allow camera and microphone to join", "error");
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    socketRef.current?.disconnect();
    streamRef.current = null;
    pcRef.current = null;
    setJoined(false);
    setSharing(false);
    setStatus("Call ended");
  };

  const toggleMic = () => {
    const t = streamRef.current?.getAudioTracks()[0];
    if (t) { t.enabled = !t.enabled; setMic(t.enabled); }
  };
  const toggleCam = () => {
    const t = streamRef.current?.getVideoTracks()[0];
    if (t) { t.enabled = !t.enabled; setCam(t.enabled); }
  };
  const share = async () => {
    try {
      if (sharing) {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = camStream.getVideoTracks()[0];
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
        await sender?.replaceTrack(track);
        streamRef.current.getVideoTracks().forEach((t) => t.stop());
        streamRef.current.removeTrack(streamRef.current.getVideoTracks()[0]);
        streamRef.current.addTrack(track);
        localRef.current.srcObject = streamRef.current;
        setSharing(false);
        push("Camera restored");
        return;
      }
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
      await sender?.replaceTrack(track);
      localRef.current.srcObject = display;
      setSharing(true);
      track.onended = () => share();
      push("Screen sharing started");
    } catch {
      push("Screen sharing was cancelled", "error");
    }
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Telemedicine</span>
          <h1>Video consultation</h1>
          <p>{peer ? `Private room with ${peer.name}.` : "A private virtual consultation room."}</p>
        </div>
      </div>
      <div className="video-shell">
        <div className="video-stage">
          <video ref={remoteRef} autoPlay playsInline className="remote-video" />
          {!joined && (
            <div className="video-placeholder">
              <div className="video-icon" style={{ margin: "0 auto 16px", width: 70, height: 70, borderRadius: 22, display: "grid", placeItems: "center", background: "rgba(255,255,255,.1)" }}><Video size={36} /></div>
              <h2>Your consultation room is ready</h2>
              <p>Allow camera and microphone access when prompted.</p>
              <button className="primary-btn" onClick={join}><Video size={18} /> Join consultation</button>
            </div>
          )}
          <video ref={localRef} autoPlay muted playsInline className={joined ? "local-video" : "local-video"} style={{ display: joined ? "block" : "none" }} />
          <div className="call-status"><i className={status === "Connected" ? "live" : ""} />{status}</div>
          {joined && (
            <div className="call-controls">
              <button onClick={toggleMic} className={!mic ? "off" : ""} title="Microphone">{mic ? <Mic /> : <MicOff />}</button>
              <button onClick={toggleCam} className={!cam ? "off" : ""} title="Camera">{cam ? <Video /> : <VideoOff />}</button>
              <button onClick={share} className={sharing ? "off" : ""} title="Share screen"><MonitorUp /></button>
              <button className="hangup" onClick={stop} title="Leave call"><PhoneOff /></button>
            </div>
          )}
        </div>
        <aside className="call-sidebar">
          <div className="secure-note"><ShieldCheck /><div><b>Private consultation</b><span>Only you and your care partner are invited to this room.</span></div></div>
          <div className="call-info"><span>With</span><b>{peer?.name || "Care partner"}</b></div>
          <div className="call-info"><span>Room</span><b>{roomId.toUpperCase()}</b></div>
          <div className="call-info"><span>Helpful tip</span><p className="muted">Use headphones in a quiet room. Screen share is available after you join.</p></div>
        </aside>
      </div>
    </div>
  );
}
