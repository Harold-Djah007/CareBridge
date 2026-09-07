import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays, FileText, MessageCircle, Paperclip, Search, Send, ShieldCheck,
  Sparkles, Stethoscope, UserPlus, Video,
} from "lucide-react";
import { io } from "socket.io-client";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { api, socketOptions, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { roomIdFor } from "../utils";
import Avatar from "../components/Avatar";
import Presence from "../components/Presence";
import RxPad from "../components/RxPad";

const prettyTime = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function Messages() {
  const { user } = useAuth();
  const { push } = useToast();
  const shell = useOutletContext() || {};
  const refreshBadges = shell.refreshBadges || (() => Promise.resolve());
  const [params] = useSearchParams();
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [connected, setConnected] = useState(false);
  const endRef = useRef();
  const fileRef = useRef();
  const socketRef = useRef();
  const seenRef = useRef(new Set());

  const loadContacts = (keepId) => api(`/contacts?userId=${user.id}&role=${user.role}`).then((list) => {
    const rows = user.role === "nurse" ? (list || []).filter((contact) => ["doctor", "admin"].includes(contact.role)) : (list || []);
    setContacts(rows);
    const wanted = keepId || params.get("with");
    setSelected((current) => rows.find((contact) => contact.id === (wanted || current?.id)) || rows[0] || null);
    return rows;
  });

  useEffect(() => {
    loadContacts();
    const socket = io(socketUrl, socketOptions());
    socket.emit("join-user", user.id);
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("doctor-status", (payload) => {
      setContacts((list) => list.map((contact) => contact.id === payload.id ? { ...contact, available: payload.available, photo: payload.photo || contact.photo } : contact));
      setSelected((current) => current?.id === payload.id ? { ...current, available: payload.available, photo: payload.photo || current.photo } : current);
    });
    socketRef.current = socket;
    return () => socket.disconnect();
  }, [user.id]);

  useEffect(() => {
    const wanted = params.get("with");
    if (wanted) loadContacts(wanted);
  }, [params.get("with")]);

  const roomId = selected ? roomIdFor(user.id, selected.id) : "";
  useEffect(() => {
    if (!roomId || !socketRef.current) return undefined;
    socketRef.current.emit("join-room", roomId);
    api(`/messages/${roomId}?userId=${user.id}`).then((rows) => {
      setMessages(rows);
      rows.forEach((message) => seenRef.current.add(message.id));
      setContacts((list) => list.map((contact) => contact.id === selected?.id ? { ...contact, unread: 0 } : contact));
      refreshBadges();
    });

    const handler = (message) => {
      if (!message?.id || seenRef.current.has(message.id)) return;
      seenRef.current.add(message.id);
      const other = message.roomId?.split("-").find((id) => id !== user.id);
      const isCurrentRoom = message.roomId === roomId;
      const isIncoming = message.senderId !== user.id;

      if (isCurrentRoom) {
        setMessages((previous) => [...previous, message]);
        setContacts((list) => list.map((contact) => contact.id === other ? {
          ...contact,
          unread: 0,
          lastMessage: { text: message.text, timestamp: message.timestamp, senderId: message.senderId },
        } : contact));
        if (isIncoming) {
          api(`/messages/${roomId}/read`, { method: "PATCH" }).then(refreshBadges).catch(() => refreshBadges());
        } else {
          refreshBadges();
        }
      } else {
        setContacts((list) => list.map((contact) => contact.id === other ? {
          ...contact,
          unread: Number(contact.unread || 0) + (isIncoming ? 1 : 0),
          lastMessage: { text: message.text, timestamp: message.timestamp, senderId: message.senderId },
        } : contact));
        refreshBadges();
      }
    };

    socketRef.current.on("chat-message", handler);
    return () => socketRef.current?.off("chat-message", handler);
  }, [roomId, selected?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendText = (value) => {
    if (!value.trim() || !selected) return;
    if (user.role === "nurse" && selected.role === "patient") return push("Nurses cannot message patients directly.", "error");
    socketRef.current.emit("chat-message", { roomId, senderId: user.id, text: value.trim() });
    setText("");
  };

  const onFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    sendText(`Shared a file: ${file.name}`);
    push(`Attached ${file.name}`);
  };

  const visible = useMemo(() => contacts.filter((contact) => `${contact.name} ${contact.specialty || ""} ${contact.role || ""}`.toLowerCase().includes(query.toLowerCase())), [contacts, query]);
  const unread = contacts.reduce((sum, contact) => sum + Number(contact.unread || 0), 0);
  const label = user.role === "doctor" ? "Clinical inbox" : user.role === "nurse" ? "Clinical messages" : user.role === "admin" ? "Switchboard" : "Care messages";

  return (
    <div className="px-page px-messages">
      <section className="px-message-head">
        <div><span className="px-kicker"><Sparkles size={14} /> Secure communication</span><h1>{label}</h1><p>One conversation surface for care coordination, follow-up and live clinical context.</p></div>
        <div className="px-message-head-meta"><span className={connected ? "live" : "offline"}><i /> {connected ? "Live channel" : "Reconnecting"}</span><span>{contacts.length} contacts</span><span>{unread} unread</span>{user.role === "patient" && <Link className="px-primary" to="/care?from=messages"><UserPlus size={16} /> Add clinician</Link>}</div>
      </section>

      <section className="px-comm-shell">
        <aside className="px-inbox-rail">
          <div className="px-inbox-title"><span>Conversations</span><strong>{contacts.length}</strong></div>
          <label className="px-inbox-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" /></label>
          <div className="px-contact-list">
            {visible.map((contact) => <button key={contact.id} type="button" className={selected?.id === contact.id ? "active" : ""} onClick={() => setSelected(contact)}>
              <span className="px-contact-avatar"><Avatar person={contact} /><i className={contact.available === false ? "busy" : "online"} /></span>
              <span className="px-contact-copy"><strong>{contact.name}</strong><small>{contact.lastMessage?.text || contact.specialty || contact.role || "Start a conversation"}</small></span>
              <span className="px-contact-meta">{contact.lastMessage?.timestamp && <time>{prettyTime(contact.lastMessage.timestamp)}</time>}{contact.unread > 0 && <em>{contact.unread}</em>}</span>
            </button>)}
            {visible.length === 0 && <div className="px-empty compact"><MessageCircle size={24} /><h3>No matching conversations</h3></div>}
          </div>
        </aside>

        <main className="px-thread-pane">
          {selected ? <>
            <header className="px-thread-head">
              <div className="px-thread-person"><Avatar person={selected} /><div><h2>{selected.name}</h2><span>{selected.specialty || selected.role || "Care contact"}</span>{selected.role === "doctor" || user.role === "patient" ? <Presence person={selected} /> : null}</div></div>
              <div className="px-thread-actions">
                {user.role === "patient" && <><Link to="/appointments"><CalendarDays size={15} /> Book</Link><Link className="strong" to={`/video?with=${selected.id}`}><Video size={15} /> Video</Link></>}
                {user.role === "doctor" && selected.role === "patient" && <><Link to={`/records/${selected.id}`}><FileText size={15} /> Chart</Link><Link className="strong" to={`/video?with=${selected.id}`}><Video size={15} /> Consult</Link></>}
              </div>
            </header>

            <div className="px-thread-scroll">
              <div className="px-thread-security"><ShieldCheck size={14} /> Authenticated CareBridge conversation</div>
              {messages.length === 0 && <div className="px-empty"><MessageCircle size={28} /><h3>Start the conversation</h3><p>Messages with {selected.name.split(" ")[0]} will appear here.</p></div>}
              {messages.map((message) => <div key={message.id} className={`px-message-row ${message.senderId === user.id ? "mine" : "theirs"}`}>
                {message.senderId !== user.id && <Avatar person={selected} className="small" />}
                <div className="px-message-bubble"><p>{message.text}</p><small>{prettyTime(message.timestamp)}</small></div>
              </div>)}
              <div ref={endRef} />
            </div>

            <form className="px-composer" onSubmit={(event) => { event.preventDefault(); sendText(text); }}>
              <input type="file" hidden ref={fileRef} onChange={onFile} />
              <button type="button" title="Attach file" onClick={() => fileRef.current?.click()}><Paperclip size={18} /></button>
              <textarea rows="1" value={text} onChange={(e) => setText(e.target.value)} placeholder={selected.available === false && user.role === "patient" ? "Leave a secure message…" : "Write a message…"} />
              <button className="send" type="submit" aria-label="Send"><Send size={18} /></button>
            </form>
          </> : <div className="px-empty large"><MessageCircle size={32} /><h3>Choose a conversation</h3><p>Select a care contact to open the secure thread.</p></div>}
        </main>

        <aside className="px-context-pane">
          {selected ? <>
            <div className="px-context-profile"><Avatar person={selected} className="large" /><h3>{selected.name}</h3><p>{selected.specialty || selected.role || "Care contact"}</p>{selected.role === "doctor" ? <Presence person={selected} /> : null}</div>
            <div className="px-context-stack">
              {user.role === "patient" && <><Link to="/appointments"><CalendarDays size={17} /><span><strong>Book care</strong><small>Schedule with this clinician</small></span></Link><Link to={`/video?with=${selected.id}`}><Video size={17} /><span><strong>Video consult</strong><small>Open a private room</small></span></Link></>}
              {user.role === "doctor" && selected.role === "patient" && <><Link to={`/records/${selected.id}`}><FileText size={17} /><span><strong>Patient chart</strong><small>Open longitudinal record</small></span></Link><Link to={`/video?with=${selected.id}`}><Video size={17} /><span><strong>Teleconsult</strong><small>Start secure consultation</small></span></Link></>}
              {user.role === "nurse" && <div><Stethoscope size={17} /><span><strong>Clinical channel</strong><small>Use this for dispensing coordination.</small></span></div>}
            </div>
            <div className="px-context-trust"><ShieldCheck size={17} /><span><strong>Protected context</strong><small>Authenticated identities and room membership are enforced by CareBridge.</small></span></div>
          </> : <div className="px-empty compact"><ShieldCheck size={24} /><h3>Conversation context</h3></div>}
        </aside>
      </section>

      {user.role === "doctor" && selected?.role === "patient" && <section className="px-rx-zone"><header><span className="px-kicker">Clinical action</span><h2>Issue prescription without leaving the thread</h2></header><RxPad patient={selected} source="messages" onIssued={(rx) => sendText(`Issued a prescription: ${rx.drug}. Open Prescriptions for details.`)} /></section>}
    </div>
  );
}
