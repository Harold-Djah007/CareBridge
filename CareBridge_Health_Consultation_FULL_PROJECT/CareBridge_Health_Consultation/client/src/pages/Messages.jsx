import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Paperclip, Search } from "lucide-react";
import { io } from "socket.io-client";
import { api } from "../api";
import { useAuth } from "../main";

const socket = io("http://localhost:5000", { autoConnect: false });

export default function Messages() {
  const { user } = useAuth();
  const [contacts,setContacts] = useState([]);
  const [selected,setSelected] = useState(null);
  const [messages,setMessages] = useState([]);
  const [text,setText] = useState("");
  const endRef = useRef();

  useEffect(()=>{
    api("/doctors").then(ds=>{
      if(user.role==="patient"){ setContacts(ds); setSelected(ds[0]); }
      else { const p={id:"p1",name:"Ama Mensah",avatar:"AM",specialty:"Patient"}; setContacts([p]); setSelected(p); }
    });
    socket.connect(); socket.emit("join-user",user.id);
    return ()=>socket.disconnect();
  },[]);

  const roomId = selected ? [user.id,selected.id].sort().join("-") : "";
  useEffect(()=>{
    if(!roomId) return;
    socket.emit("join-room",roomId);
    api(`/messages/${roomId}`).then(setMessages);
    const handler=m=>{ if(m.roomId===roomId) setMessages(prev=>[...prev,m]); };
    socket.on("chat-message",handler);
    return ()=>socket.off("chat-message",handler);
  },[roomId]);
  useEffect(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),[messages]);

  const send=e=>{
    e.preventDefault(); if(!text.trim()) return;
    socket.emit("chat-message",{roomId,senderId:user.id,text:text.trim()}); setText("");
  };

  return <div>
    <div className="page-title"><div><span className="eyebrow">Secure messages</span><h1>Care conversations</h1><p>Stay connected with your {user.role==="patient"?"doctors":"patients"} before and after consultations.</p></div></div>
    <div className="chat-layout">
      <aside className="contact-panel">
        <div className="search-box"><Search size={17}/><input placeholder="Search conversations"/></div>
        {contacts.map(c=><button key={c.id} onClick={()=>setSelected(c)} className={`contact ${selected?.id===c.id?"selected":""}`}>
          <div className="avatar">{c.avatar}</div><span><b>{c.name}</b><small>{c.specialty || "Patient"}</small></span>
        </button>)}
      </aside>
      <section className="chat-panel">
        {selected ? <>
          <div className="chat-head"><div className="avatar">{selected.avatar}</div><div><strong>{selected.name}</strong><span><i/> Online</span></div></div>
          <div className="messages">
            {messages.length===0 && <div className="empty compact"><MessageCircle size={32}/><h3>Start the conversation</h3><p>Messages are delivered instantly.</p></div>}
            {messages.map(m=><div key={m.id} className={`bubble-wrap ${m.senderId===user.id?"mine":""}`}><div className="bubble">{m.text}<small>{new Date(m.timestamp).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</small></div></div>)}
            <div ref={endRef}/>
          </div>
          <form className="message-composer" onSubmit={send}><button type="button" className="icon-btn"><Paperclip size={19}/></button><input placeholder="Write a message..." value={text} onChange={e=>setText(e.target.value)}/><button className="send-btn"><Send size={18}/></button></form>
        </> : <div className="empty"><MessageCircle/><h3>Select a conversation</h3></div>}
      </section>
    </div>
  </div>;
}
