import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2, Headphones, MessageCircle, Mic, MicOff, MonitorUp, PhoneOff,
  ShieldCheck, Stethoscope, Video, VideoOff,
} from "lucide-react";
import { io } from "socket.io-client";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth, useToast } from "../state";
import { api, socketOptions, socketUrl } from "../api";
import { roomIdFor } from "../utils";
import { IMAGERY } from "../imagery";
import Avatar from "../components/Avatar";
import RxPad from "../components/RxPad";
import PageHero, { EmptyPlate } from "../components/PageHero";

export default function VideoConsultation() {
  const { user } = useAuth();
  const { push } = useToast();
  const [params] = useSearchParams();
  const localRef = useRef();
  const remoteRef = useRef();
  const pcRef = useRef();
  const streamRef = useRef();
  const socketRef = useRef();
  const [contacts, setContacts] = useState([]);
  const [peer, setPeer] = useState(null);
  const [joined, setJoined] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState("Ready to join");
  const [consent, setConsent] = useState(user.role !== "patient");

  useEffect(() => {
    api(`/contacts?userId=${user.id}&role=${user.role}`).then((list) => {
      const usable = user.role === "doctor" ? list.filter((contact) => contact.role === "patient") : list;
      setContacts(usable);
      const wanted = params.get("with");
      setPeer(usable.find((contact) => contact.id === wanted) || null);
    });
    return () => stop();
  }, [user.id]);

  const otherId = peer?.id;
  const roomId = otherId ? roomIdFor(user.id, otherId) : "";

  const initPeer = () => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.onicecandidate = (event) => event.candidate && socketRef.current.emit("webrtc-ice", { roomId, candidate: event.candidate });
    pc.ontrack = (event) => { remoteRef.current.srcObject = event.streams[0]; setStatus("Connected"); };
    streamRef.current?.getTracks().forEach((track) => pc.addTrack(track, streamRef.current));
    pcRef.current = pc;
    return pc;
  };

  const join = async () => {
    if (!peer || !roomId) return push("Choose who you are calling first.", "error");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      const socket = io(socketUrl, socketOptions());
      socketRef.current = socket;
      socket.emit("join-room", roomId);
      let pc = initPeer();
      socket.on("webrtc-offer", async ({ offer }) => {
        if (!pcRef.current) pc = initPeer();
        await pcRef.current.setRemoteDescription(offer);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit("webrtc-answer", { roomId, answer });
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
    streamRef.current?.getTracks().forEach((track) => track.stop());
    pcRef.current?.close();
    socketRef.current?.disconnect();
    streamRef.current = null;
    pcRef.current = null;
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
  };
  const share = async () => {
    try {
      if (sharing) {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = camStream.getVideoTracks()[0];
        const sender = pcRef.current?.getSenders().find((item) => item.track?.kind === "video");
        await sender?.replaceTrack(track);
        streamRef.current.getVideoTracks().forEach((item) => item.stop());
        streamRef.current.addTrack(track);
        if (localRef.current) localRef.current.srcObject = streamRef.current;
        setSharing(false);
        push("Camera restored");
        return;
      }
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((item) => item.track?.kind === "video");
      await sender?.replaceTrack(track);
      if (localRef.current) localRef.current.srcObject = display;
      setSharing(true);
      track.onended = () => share();
      push("Screen sharing started");
    } catch {
      push("Screen sharing was cancelled", "error");
    }
  };

  const enter = async () => {
    if (!peer) return push("Choose who you are calling first.", "error");
    if (user.role === "patient") {
      if (!consent) return push("Please confirm telehealth consent first.", "error");
      await api("/consents", { method: "POST", body: JSON.stringify({ patientId: user.id, type: "telehealth" }) });
    }
    join();
  };

  return (
    <div className="teleconsult-workspace">
      <PageHero
        scene="consult"
        eyebrow="Telemedicine workspace"
        title="Video consultation"
        lead={peer ? `Private consultation room with ${peer.name}.` : "Choose a care contact, complete the pre-call check and join securely."}
        actions={peer && !joined ? <Link className="secondary-btn" to={`/messages?with=${peer.id}`}><MessageCircle size={15} /> Message first</Link> : null}
      />

      <div className="teleconsult-status-strip">
        <span><ShieldCheck size={14} /> Authenticated room</span>
        <span><Headphones size={14} /> Headphones recommended</span>
        <span className={joined ? "connected" : "standby"}><i /> {joined ? status : "Standby"}</span>
      </div>

      <div className={`teleconsult-shell ${joined ? "in-call" : "pre-call"}`}>
        <section className="teleconsult-stage">
          <video ref={remoteRef} autoPlay playsInline className="remote-video" />
          {!joined && (
            <div className="consult-lobby">
              <div className="consult-lobby-image" style={{ backgroundImage: `url(${IMAGERY.consult})` }}><div><span className="eyebrow">Private telehealth</span><h2>{peer ? "Your consultation room is ready" : "Choose a consultation partner"}</h2><p>{peer ? "Complete the quick privacy and device check, then enter the room." : "Only authorised CareBridge contacts can be invited into this room."}</p></div></div>
              <div className="consult-lobby-panel">
                {!peer ? (
                  <>
                    <div className="consult-lobby-heading"><Stethoscope size={20} /><div><h3>{user.role === "patient" ? "Choose a clinician" : "Choose a patient"}</h3><p>Select the person for this consultation.</p></div></div>
                    <div className="consult-contact-grid">{contacts.map((contact) => <button type="button" key={contact.id} className="consult-contact-card" onClick={() => setPeer(contact)}><Avatar person={contact} /><span><b>{contact.name}</b><small>{contact.specialty || contact.city || contact.role}</small></span></button>)}</div>
                    {contacts.length === 0 && <EmptyPlate compact scene="consult" title="No eligible contacts" hint="Open Messages or your care team to establish a contact first." />}
                  </>
                ) : (
                  <>
                    <div className="consult-peer-card"><Avatar person={peer} className="large" /><div><span className="eyebrow">Consulting with</span><h2>{peer.name}</h2><p>{peer.specialty || peer.role || "Care contact"}</p></div><button className="ghost-btn" type="button" onClick={() => setPeer(null)}>Change</button></div>
                    <div className="consult-checklist">
                      <div><CheckCircle2 size={17} /><span><b>Private space</b><small>Use a quiet place where health information cannot be overheard.</small></span></div>
                      <div><CheckCircle2 size={17} /><span><b>Camera & microphone</b><small>Your browser will ask for permission when you join.</small></span></div>
                      <div><CheckCircle2 size={17} /><span><b>Stable connection</b><small>Wi-Fi or reliable mobile data is recommended.</small></span></div>
                    </div>
                    {user.role === "patient" && <label className="telehealth-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span><b>I consent to this telehealth consultation</b><small>I understand that clinical information will be discussed in this private CareBridge room.</small></span></label>}
                    <button className="primary-btn full consult-join" disabled={!peer || (user.role === "patient" && !consent)} onClick={enter}><Video size={18} /> Join consultation</button>
                  </>
                )}
              </div>
            </div>
          )}
          <video ref={localRef} autoPlay muted playsInline className="local-video" style={{ display: joined ? "block" : "none" }} />
          {joined && <div className="call-status"><i className={status === "Connected" ? "live" : ""} />{status}</div>}
          {joined && (
            <div className="product-call-controls">
              <button onClick={toggleMic} className={!mic ? "off" : ""} title={mic ? "Mute microphone" : "Unmute microphone"}>{mic ? <Mic /> : <MicOff />}</button>
              <button onClick={toggleCam} className={!cam ? "off" : ""} title={cam ? "Turn camera off" : "Turn camera on"}>{cam ? <Video /> : <VideoOff />}</button>
              <button onClick={share} className={sharing ? "sharing" : ""} title="Share screen"><MonitorUp /></button>
              <button className="hangup" onClick={stop} title="Leave consultation"><PhoneOff /></button>
            </div>
          )}
        </section>

        <aside className="teleconsult-context">
          <div className="teleconsult-context-head"><span className="eyebrow">Consultation context</span><h3>{peer?.name || "No participant selected"}</h3></div>
          {peer ? <div className="teleconsult-person"><Avatar person={peer} className="large" /><div><b>{peer.name}</b><span>{peer.specialty || peer.role || "Care contact"}</span></div></div> : <EmptyPlate compact scene="consult" title="Choose a participant" />}
          <div className="teleconsult-room-data"><div><span>Room</span><b>{roomId ? roomId.toUpperCase() : "Not assigned"}</b></div><div><span>Status</span><b>{status}</b></div><div><span>Video</span><b>{joined ? cam ? "On" : "Off" : "Standby"}</b></div><div><span>Audio</span><b>{joined ? mic ? "On" : "Muted" : "Standby"}</b></div></div>
          <div className="teleconsult-security"><ShieldCheck size={17} /><div><b>Private consultation</b><small>Room access is tied to authenticated CareBridge identities and permitted care relationships.</small></div></div>
          {peer && <div className="teleconsult-context-actions"><Link to={`/messages?with=${peer.id}`} className="secondary-btn full"><MessageCircle size={15} /> Open messages</Link>{user.role === "doctor" && peer.role === "patient" && <Link to={`/records/${peer.id}`} className="secondary-btn full">Open patient chart</Link>}</div>}
          {user.role === "doctor" && peer?.role === "patient" && <div className="teleconsult-rx"><RxPad patient={peer} source="video" compact onIssued={() => push("Prescription issued. The patient can print or collect it.")} /></div>}
        </aside>
      </div>
    </div>
  );
}
