import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2, Headphones, MessageCircle, Mic, MicOff, MonitorUp, PhoneOff,
  ShieldCheck, Sparkles, Stethoscope, Video, VideoOff,
} from "lucide-react";
import { io } from "socket.io-client";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth, useToast } from "../state";
import { api, socketOptions, socketUrl } from "../api";
import { roomIdFor } from "../utils";
import { IMAGERY } from "../imagery";
import Avatar from "../components/Avatar";
import RxPad from "../components/RxPad";

export default function VideoConsultation() {
  const { user } = useAuth();
  const { push } = useToast();
  const [params] = useSearchParams();
  const localRef = useRef();
  const remoteRef = useRef();
  const pcRef = useRef();
  const streamRef = useRef();
  const socketRef = useRef();
  const displayRef = useRef();
  const callVersion = useRef(0);
  const joiningRef = useRef(false);
  const mountedRef = useRef(true);
  const [joining, setJoining] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [peer, setPeer] = useState(null);
  const [joined, setJoined] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [consent, setConsent] = useState(user.role !== "patient");

  useEffect(() => {
    mountedRef.current = true;
    api(`/contacts?userId=${user.id}&role=${user.role}`).then((list) => {
      const usable = user.role === "doctor" ? list.filter((contact) => contact.role === "patient") : list;
      setContacts(usable);
      const wanted = params.get("with");
      setPeer(usable.find((contact) => contact.id === wanted) || null);
    }).catch(() => push("Could not load consultation contacts. Please try again.", "error"));
    return () => { mountedRef.current = false; stop(); };
  }, [user.id]);

  const otherId = peer?.id;
  const roomId = otherId ? roomIdFor(user.id, otherId) : "";

  const initPeer = (config) => {
    const pc = new RTCPeerConnection(config);
    pc.onicecandidate = (event) => event.candidate && socketRef.current?.emit("webrtc-ice", { roomId, candidate: event.candidate });
    pc.ontrack = (event) => { if (remoteRef.current) remoteRef.current.srcObject = event.streams[0]; setStatus("Connected"); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") setStatus("Connection failed. End the call and try again.");
      if (pc.connectionState === "disconnected") setStatus("Reconnecting");
      if (pc.connectionState === "connected") setStatus("Connected");
    };
    streamRef.current?.getTracks().forEach((track) => pc.addTrack(track, streamRef.current));
    pcRef.current = pc;
    return pc;
  };

  const join = async () => {
    if (!mountedRef.current) return;
    if (!peer || !roomId) return push("Choose who you are calling first.", "error");
    try {
      const version = ++callVersion.current;
      const config = await api("/rtc/config");
      if (callVersion.current !== version) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (callVersion.current !== version) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      const socket = io(socketUrl, socketOptions());
      socketRef.current = socket;
      let pc = initPeer(config);
      const candidates = [];
      const flushCandidates = async () => {
        for (const candidate of candidates.splice(0)) await pc.addIceCandidate(candidate);
      };
      const signalingError = () => { setStatus("Connection error"); push("Could not connect the consultation. End the call and retry.", "error"); };
      let offering = false;
      const makeOffer = async () => {
        if (offering || !(user.role === "doctor" || user.role === "admin") || pc.signalingState !== "stable") return;
        offering = true;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc-offer", { roomId, offer });
        } catch { signalingError(); }
        finally { offering = false; }
      };
      socket.on("webrtc-participant-ready", makeOffer);
      socket.on("webrtc-hangup", () => { stop(false); push("The other participant ended the consultation."); });
      socket.on("connect", () => socket.emit("join-room", roomId, (result) => {
        if (!result?.ok) { stop(); push("You cannot join this consultation room.", "error"); return; }
        if (result.participants > 1) makeOffer();
      }));
      socket.on("connect_error", () => { stop(); push("Your consultation connection could not be authenticated.", "error"); });
      socket.on("webrtc-offer", async ({ offer }) => {
        try {
          if (!pcRef.current) pc = initPeer(config);
          await pcRef.current.setRemoteDescription(offer);
          await flushCandidates();
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          socket.emit("webrtc-answer", { roomId, answer });
        } catch { signalingError(); }
      });
      socket.on("webrtc-answer", async ({ answer }) => { try { await pc.setRemoteDescription(answer); await flushCandidates(); } catch { signalingError(); } });
      socket.on("webrtc-ice", async ({ candidate }) => { try { if (!pc.remoteDescription) candidates.push(candidate); else await pc.addIceCandidate(candidate); } catch { signalingError(); } });
      setJoined(true);
      setStatus("Waiting for participant");
      setMic(true);
      setCam(true);
    } catch (error) {
      stop(false);
      push(error.name === "NotAllowedError" ? "Allow camera and microphone to join" : error.message || "Could not start the consultation.", "error");
    }
  };

  const stop = (notify = true) => {
    const socket = socketRef.current;
    if (notify && socket?.connected) socket.timeout(2000).emit("webrtc-hangup", { roomId }, () => socket.disconnect());
    else socket?.disconnect();
    callVersion.current += 1;
    displayRef.current?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    displayRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (pcRef.current) { pcRef.current.onicecandidate = null; pcRef.current.ontrack = null; pcRef.current.onconnectionstatechange = null; }
    pcRef.current?.close();
    socketRef.current?.removeAllListeners();

    streamRef.current = null;
    pcRef.current = null;
    socketRef.current = null;
    if (localRef.current) localRef.current.srcObject = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;
    setJoined(false);
    setSharing(false);
    setStatus("Call ended");
  };

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMic(track.enabled); }
  };
  const toggleCam = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCam(track.enabled); }
    const displayTrack = displayRef.current?.getVideoTracks()[0];
    if (displayTrack && track) displayTrack.enabled = track.enabled;
  };
  const share = async () => {
    try {
      if (displayRef.current) { await restoreCamera(); return; }
      const version = callVersion.current;
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      if (version !== callVersion.current || !pcRef.current) { display.getTracks().forEach((track) => track.stop()); return; }
      displayRef.current = display;
      const track = display.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((item) => item.track?.kind === "video");
      await sender?.replaceTrack(track);
      if (localRef.current) localRef.current.srcObject = display;
      setSharing(true);
      track.onended = () => restoreCamera().catch(() => push("Could not restore the camera.", "error"));
    } catch {
      displayRef.current?.getTracks().forEach((track) => track.stop());
      displayRef.current = null;
      setSharing(false);
      push("Screen sharing was cancelled", "error");
    }
  };

  const restoreCamera = async () => {
    const display = displayRef.current;
    displayRef.current = null;
    const track = streamRef.current?.getVideoTracks()[0];
    const sender = pcRef.current?.getSenders().find((item) => item.track?.kind === "video");
    try {
      if (track && sender) await sender.replaceTrack(track);
      if (localRef.current) localRef.current.srcObject = streamRef.current;
    } finally {
      display?.getTracks().forEach((item) => { item.onended = null; item.stop(); });
      setSharing(false);
    }
  };

  const enter = async () => {
    if (joiningRef.current || joined) return;
    if (!peer) return push("Choose who you are calling first.", "error");
    joiningRef.current = true;
    setJoining(true);
    try {
      if (user.role === "patient") {
        if (!consent) return push("Please confirm telehealth consent first.", "error");
        await api("/consents", { method: "POST", body: JSON.stringify({ patientId: user.id, type: "telehealth" }) });
      }
      await join();
    } catch (error) { push(error.message || "Could not enter the consultation.", "error"); }
    finally { joiningRef.current = false; setJoining(false); }
  };

  return (
    <div className="px-page px-video-room">
      <section className="px-video-titlebar">
        <div><span className="px-kicker"><Sparkles size={14} /> Private telehealth</span><h1>Consultation room</h1><p>{peer ? `Secure session with ${peer.name}` : "Choose a participant, check your environment and enter when ready."}</p></div>
        <div className="px-video-assurance"><span><ShieldCheck size={15} /> Authenticated room</span><span><Headphones size={15} /> Headphones recommended</span><span className={joined ? "live" : "standby"}><i /> {joined ? status : "Standby"}</span></div>
      </section>

      <section className={`px-video-shell ${joined ? "in-call" : "lobby"}`}>
        <main className="px-video-stage">
          <video ref={remoteRef} autoPlay playsInline className="px-remote-video" />
          {!joined && <div className="px-video-lobby" style={{ backgroundImage: `linear-gradient(135deg, rgba(4,18,25,.88), rgba(4,18,25,.46)), url(${IMAGERY.consult})` }}>
            <div className="px-lobby-copy"><span className="px-kicker">CareBridge Video</span><h2>{peer ? "Everything is ready for the call." : "A quieter way to meet your care team."}</h2><p>{peer ? "Review the final checks and enter the private room when you are comfortable." : "Only authenticated CareBridge contacts can be selected for this consultation."}</p></div>
            <div className="px-lobby-card">
              {!peer ? <><header><Stethoscope size={19} /><div><strong>{user.role === "patient" ? "Choose clinician" : "Choose patient"}</strong><small>Select the person for this consultation</small></div></header><div className="px-lobby-contacts">{contacts.map((contact) => <button type="button" key={contact.id} onClick={() => setPeer(contact)}><Avatar person={contact} /><span><strong>{contact.name}</strong><small>{contact.specialty || contact.city || contact.role}</small></span></button>)}</div>{contacts.length === 0 && <div className="px-empty compact"><Video size={24} /><h3>No eligible contacts</h3></div>}</> : <><div className="px-lobby-peer"><Avatar person={peer} className="large" /><div><span className="px-kicker">Consulting with</span><h2>{peer.name}</h2><p>{peer.specialty || peer.role || "Care contact"}</p></div><button type="button" disabled={joining} onClick={() => setPeer(null)}>Change</button></div><div className="px-device-checks"><div><CheckCircle2 size={16} /><span><strong>Private space</strong><small>Keep health information confidential.</small></span></div><div><CheckCircle2 size={16} /><span><strong>Camera & microphone</strong><small>Browser permission is requested on entry.</small></span></div><div><CheckCircle2 size={16} /><span><strong>Stable connection</strong><small>Wi-Fi or reliable mobile data recommended.</small></span></div></div>{user.role === "patient" && <label className="px-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span><strong>I consent to this telehealth consultation</strong><small>I understand clinical information will be discussed in this room.</small></span></label>}<button className="px-primary px-enter-room" type="button" disabled={joining || !peer || (user.role === "patient" && !consent)} onClick={enter}><Video size={18} /> {joining ? "Connecting…" : "Enter consultation"}</button></>}
            </div>
          </div>}
          <video ref={localRef} autoPlay muted playsInline className="px-local-video" style={{ display: joined ? "block" : "none" }} />
          {joined && <div className="px-call-state"><i className={status === "Connected" ? "live" : ""} /> {status}</div>}
          {joined && <div className="px-call-controls"><button type="button" aria-label={mic ? "Mute microphone" : "Unmute microphone"} onClick={toggleMic} className={!mic ? "off" : ""}>{mic ? <Mic /> : <MicOff />}</button><button type="button" aria-label={cam ? "Turn camera off" : "Turn camera on"} onClick={toggleCam} className={!cam ? "off" : ""}>{cam ? <Video /> : <VideoOff />}</button><button type="button" aria-label={sharing ? "Stop screen sharing" : "Share screen"} onClick={share} className={sharing ? "sharing" : ""}><MonitorUp /></button><button type="button" aria-label="End consultation" className="hangup" onClick={() => stop()}><PhoneOff /></button></div>}
        </main>

        <aside className="px-video-context">
          <header><span className="px-kicker">Clinical context</span><h3>{peer?.name || "No participant"}</h3></header>
          {peer && <div className="px-video-person"><Avatar person={peer} className="large" /><strong>{peer.name}</strong><span>{peer.specialty || peer.role}</span></div>}
          <div className="px-room-facts"><div><span>Room</span><strong>{roomId ? roomId.toUpperCase() : "Not assigned"}</strong></div><div><span>Status</span><strong>{status}</strong></div><div><span>Video</span><strong>{joined ? cam ? "On" : "Off" : "Standby"}</strong></div><div><span>Audio</span><strong>{joined ? mic ? "On" : "Muted" : "Standby"}</strong></div></div>
          <div className="px-context-trust"><ShieldCheck size={17} /><span><strong>Private consultation</strong><small>Room access is tied to authenticated CareBridge identities.</small></span></div>
          {peer && <div className="px-video-links"><Link to={`/messages?with=${peer.id}`}><MessageCircle size={15} /> Open messages</Link>{user.role === "doctor" && peer.role === "patient" && <Link to={`/records/${peer.id}`}>Open patient chart</Link>}</div>}
          {user.role === "doctor" && peer?.role === "patient" && <div className="px-video-rx"><RxPad patient={peer} source="video" compact onIssued={() => push("Prescription issued.")} /></div>}
        </aside>
      </section>
    </div>
  );
}
