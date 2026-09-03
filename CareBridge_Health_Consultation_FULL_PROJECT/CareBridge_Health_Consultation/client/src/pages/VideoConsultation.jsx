import React, { useEffect, useRef, useState } from "react";
import { Video, VideoOff, Mic, MicOff, PhoneOff, MonitorUp, ShieldCheck } from "lucide-react";
import { io } from "socket.io-client";
import { useAuth } from "../main";

const socket=io("http://localhost:5000",{autoConnect:false});
export default function VideoConsultation(){
  const {user}=useAuth();
  const localRef=useRef(), remoteRef=useRef(), pcRef=useRef(), streamRef=useRef();
  const [joined,setJoined]=useState(false),[mic,setMic]=useState(true),[cam,setCam]=useState(true),[status,setStatus]=useState("Ready to join");
  const otherId=user.role==="patient"?"d1":"p1";
  const roomId=[user.id,otherId].sort().join("-");

  useEffect(()=>()=>stop(),[]);
  const initPeer=()=>{
    const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
    pc.onicecandidate=e=>e.candidate&&socket.emit("webrtc-ice",{roomId,candidate:e.candidate});
    pc.ontrack=e=>{remoteRef.current.srcObject=e.streams[0];setStatus("Connected")};
    streamRef.current?.getTracks().forEach(t=>pc.addTrack(t,streamRef.current));
    pcRef.current=pc; return pc;
  };
  const join=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
      streamRef.current=stream;localRef.current.srcObject=stream;
      socket.connect();socket.emit("join-room",roomId);
      let pc=initPeer();
      socket.on("webrtc-offer",async({offer})=>{ if(!pcRef.current) pc=initPeer(); await pcRef.current.setRemoteDescription(offer); const ans=await pcRef.current.createAnswer();await pcRef.current.setLocalDescription(ans);socket.emit("webrtc-answer",{roomId,answer:ans})});
      socket.on("webrtc-answer",async({answer})=>{await pcRef.current?.setRemoteDescription(answer)});
      socket.on("webrtc-ice",async({candidate})=>{try{await pcRef.current?.addIceCandidate(candidate)}catch{}});
      setJoined(true);setStatus("Waiting for the other participant");
      if(user.role==="doctor"){const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit("webrtc-offer",{roomId,offer})}
    }catch{setStatus("Camera or microphone permission was not granted.")}
  };
  const stop=()=>{streamRef.current?.getTracks().forEach(t=>t.stop());pcRef.current?.close();socket.disconnect();setJoined(false);setStatus("Call ended")};
  const toggleMic=()=>{const t=streamRef.current?.getAudioTracks()[0];if(t){t.enabled=!t.enabled;setMic(t.enabled)}};
  const toggleCam=()=>{const t=streamRef.current?.getVideoTracks()[0];if(t){t.enabled=!t.enabled;setCam(t.enabled)}};

  return <div>
    <div className="page-title"><div><span className="eyebrow">Telemedicine</span><h1>Video consultation</h1><p>A private virtual consultation room for your scheduled visit.</p></div></div>
    <div className="video-shell">
      <div className="video-stage">
        <video ref={remoteRef} autoPlay playsInline className="remote-video"/>
        {!joined&&<div className="video-placeholder"><div className="video-icon"><Video size={36}/></div><h2>Your consultation room is ready</h2><p>Allow camera and microphone access when prompted.</p><button className="primary-btn" onClick={join}><Video size={18}/> Join consultation</button></div>}
        {joined&&<video ref={localRef} autoPlay muted playsInline className="local-video"/>}
        <div className="call-status"><i className={status==="Connected"?"live":""}/>{status}</div>
        {joined&&<div className="call-controls"><button onClick={toggleMic} className={!mic?"off":""}>{mic?<Mic/>:<MicOff/>}</button><button onClick={toggleCam} className={!cam?"off":""}>{cam?<Video/>:<VideoOff/>}</button><button><MonitorUp/></button><button className="hangup" onClick={stop}><PhoneOff/></button></div>}
      </div>
      <aside className="call-sidebar"><div className="secure-note"><ShieldCheck/><div><b>Private consultation</b><span>This room is intended only for you and your care provider.</span></div></div><div className="call-info"><span>Room</span><b>{roomId.toUpperCase()}</b></div><div className="call-info"><span>Consultation type</span><b>Video appointment</b></div><div className="call-info"><span>Helpful tip</span><p>Use headphones in a quiet room for the clearest conversation.</p></div></aside>
    </div>
  </div>
}
