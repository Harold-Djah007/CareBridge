import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Paperclip, Search } from "lucide-react";
import { io } from "socket.io-client";
import { useSearchParams } from "react-router-dom";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../main";
import { roomIdFor } from "../utils";

export default function Messages() {
  const { user } = useAuth();
  const { push } = useToast();
  const [params] = useSearchParams();
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const endRef = useRef();
  const fileRef = useRef();
  const socketRef = useRef();

  useEffect(() => {
    api(`/contacts?userId=${user.id}&role=${user.role}`).then((list) => {
      setContacts(list);
      const wanted = params.get("with");
      setSelected(list.find((c) => c.id === wanted) || list[0] || null);
    });
    const socket = io(socketUrl, { autoConnect: true });
    socket.emit("join-user", user.id);
    socketRef.current = socket;
    return () => socket.disconnect();
  }, [user.id]);

  const roomId = selected ? roomIdFor(user.id, selected.id) : "";

  useEffect(() => {
    if (!roomId || !socketRef.current) return;
    socketRef.current.emit("join-room", roomId);
    api(`/messages/${roomId}`).then(setMessages);
    const handler = (m) => { if (m.roomId === roomId) setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]); };
    socketRef.current.on("chat-message", handler);
    return () => socketRef.current?.off("chat-message", handler);
  }, [roomId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendText = (value) => {
    if (!value.trim() || !selected) return;
    socketRef.current.emit("chat-message", { roomId, senderId: user.id, text: value.trim() });
    setText("");
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    sendText(`Shared a file: ${file.name}`);
    push(`Attached ${file.name} to the conversation`);
  };

  const visible = contacts.filter((c) => `${c.name} ${c.specialty || ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">Secure messages</span>
          <h1>Care conversations</h1>
          <p>Patients are emailed when a doctor or admin writes to them.</p>
        </div>
      </div>
      <div className="chat-layout">
        <aside className="contact-panel">
          <div className="search-box"><Search size={17} /><input placeholder="Search conversations" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          {visible.map((c) => (
            <button key={c.id} onClick={() => setSelected(c)} className={`contact ${selected?.id === c.id ? "selected" : ""}`}>
              <div className="avatar">{c.avatar}</div>
              <span><b>{c.name}</b><small>{c.specialty || c.role || "Patient"}</small></span>
            </button>
          ))}
          {visible.length === 0 && <p className="muted">No matches.</p>}
        </aside>
        <section className="chat-panel">
          {selected ? (
            <>
              <div className="chat-head">
                <div className="avatar">{selected.avatar}</div>
                <div><strong>{selected.name}</strong><span className="muted">{selected.specialty || selected.city || "Care contact"}</span></div>
              </div>
              <div className="messages">
                {messages.length === 0 && <div className="empty compact"><MessageCircle size={32} /><h3>Start the conversation</h3><p>Messages are delivered instantly.</p></div>}
                {messages.map((m) => (
                  <div key={m.id} className={`bubble-wrap ${m.senderId === user.id ? "mine" : ""}`}>
                    <div className="bubble">{m.text}<small>{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form className="message-composer" onSubmit={(e) => { e.preventDefault(); sendText(text); }}>
                <input type="file" hidden ref={fileRef} onChange={onFile} />
                <button type="button" className="icon-btn" title="Attach a file" onClick={() => fileRef.current?.click()}><Paperclip size={19} /></button>
                <input placeholder="Write a message..." value={text} onChange={(e) => setText(e.target.value)} />
                <button className="send-btn" type="submit"><Send size={18} /></button>
              </form>
            </>
          ) : <div className="empty"><MessageCircle /><h3>Select a conversation</h3></div>}
        </section>
      </div>
    </div>
  );
}
