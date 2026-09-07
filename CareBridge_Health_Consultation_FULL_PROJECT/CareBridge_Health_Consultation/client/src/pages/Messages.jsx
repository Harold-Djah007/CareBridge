import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays, FileText, MessageCircle, MoreHorizontal, Paperclip, Search, Send,
  ShieldCheck, Stethoscope, UserPlus, Video,
} from "lucide-react";
import { io } from "socket.io-client";
import { Link, useSearchParams } from "react-router-dom";
import { api, socketOptions, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { roomIdFor } from "../utils";
import { IMAGERY } from "../imagery";
import Avatar from "../components/Avatar";
import Presence from "../components/Presence";
import RxPad from "../components/RxPad";
import PageHero, { EmptyPlate } from "../components/PageHero";

const prettyTime = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function Messages() {
  const { user } = useAuth();
  const { push } = useToast();
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

  const loadContacts = (keepId) => {
    api(`/contacts?userId=${user.id}&role=${user.role}`).then((list) => {
      const rows = user.role === "nurse" ? (list || []).filter((contact) => contact.role === "doctor" || contact.role === "admin") : list;
      setContacts(rows);
      const wanted = keepId || params.get("with");
      setSelected((current) => rows.find((contact) => contact.id === (wanted || current?.id)) || (wanted ? rows.find((contact) => contact.id === wanted) : rows[0]) || null);
    });
  };

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
    api(`/messages/${roomId}?userId=${user.id}`).then(setMessages);
    const handler = (message) => {
      if (message.roomId === roomId) setMessages((previous) => previous.some((row) => row.id === message.id) ? previous : [...previous, message]);
      setContacts((list) => list.map((contact) => {
        const other = message.roomId?.split("-").find((id) => id !== user.id);
        if (contact.id !== other) return contact;
        return { ...contact, lastMessage: { text: message.text, timestamp: message.timestamp, senderId: message.senderId } };
      }));
    };
    socketRef.current.on("chat-message", handler);
    return () => socketRef.current?.off("chat-message", handler);
  }, [roomId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendText = (value) => {
    if (!value.trim() || !selected) return;
    if (user.role === "nurse" && selected.role === "patient") return push("Nurses cannot message patients. Write to a doctor or administrator.", "error");
    socketRef.current.emit("chat-message", { roomId, senderId: user.id, text: value.trim() });
    setText("");
  };

  const onFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    sendText(`Shared a file: ${file.name}`);
    push(`Attached ${file.name} to the conversation`);
  };

  const visible = useMemo(() => contacts.filter((contact) => `${contact.name} ${contact.specialty || ""} ${contact.role || ""}`.toLowerCase().includes(query.toLowerCase())), [contacts, query]);
  const unread = contacts.reduce((sum, contact) => sum + Number(contact.unread || 0), 0);

  const copy = user.role === "patient" ? {
    eyebrow: "Secure care communication", title: "Messages", lead: "Chat with your care team, book follow-up care and move into video without losing context.", list: "Care team",
  } : user.role === "doctor" ? {
    eyebrow: "Clinical communication", title: "Clinical inbox", lead: "Patient and hospital conversations with charts, video and prescribing tools kept beside the thread.", list: "Clinical conversations",
  } : user.role === "nurse" ? {
    eyebrow: "Dispensary communication", title: "Clinical messages", lead: "Coordinate medication fulfilment with consultants and hospital operations.", list: "Hospital contacts",
  } : {
    eyebrow: "Hospital communications", title: "Switchboard", lead: "Coordinate patient and staff communication from a secure operational inbox.", list: "Conversations",
  };

  return (
    <div className="messages-workspace product-messages-page">
      <PageHero
        scene="messages"
        eyebrow={copy.eyebrow}
        title={copy.title}
        lead={copy.lead}
        actions={user.role === "patient" ? <Link className="primary-btn" to="/care?from=messages"><UserPlus size={16} /> Add clinician</Link> : null}
      />

      <div className="message-status-strip">
        <span className={`product-connection ${connected ? "connected" : "offline"}`}><ShieldCheck size={14} /> {connected ? "Encrypted live channel connected" : "Reconnecting live channel"}</span>
        <span><MessageCircle size={14} /> {contacts.length} contact{contacts.length === 1 ? "" : "s"}</span>
        <span><FileText size={14} /> {unread} unread</span>
      </div>

      <div className="product-chat-workspace">
        <aside className="product-conversation-list">
          <div className="conversation-list-head"><div><span className="eyebrow">{copy.list}</span><h2>{contacts.length}</h2></div>{user.role === "patient" && <Link className="icon-btn" to="/care?from=messages" title="Add doctor"><UserPlus size={17} /></Link>}</div>
          <label className="conversation-search"><Search size={15} /><input placeholder="Search people or conversations" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="conversation-scroll">
            {visible.map((contact) => (
              <button key={contact.id} onClick={() => setSelected(contact)} className={`conversation-row ${selected?.id === contact.id ? "selected" : ""}`}>
                <span className="conversation-avatar"><Avatar person={contact} /><i className={contact.available === false ? "busy" : "online"} /></span>
                <span className="conversation-copy"><b>{contact.name}</b><small>{contact.lastMessage?.text || contact.specialty || contact.role || "Start a conversation"}</small></span>
                <span className="conversation-meta">{contact.lastMessage?.timestamp && <time>{prettyTime(contact.lastMessage.timestamp)}</time>}{contact.unread > 0 && <em>{contact.unread}</em>}</span>
              </button>
            ))}
            {visible.length === 0 && <EmptyPlate compact scene="messages" icon={MessageCircle} title="No conversations found" hint="Try another search or add a care contact." />}
          </div>
        </aside>

        <section className="product-chat-thread">
          {selected ? (
            <>
              <header className="product-chat-head">
                <Avatar person={selected} />
                <div className="grow"><h3>{selected.name}</h3><span>{selected.specialty || selected.city || selected.role || "Care contact"}</span>{selected.role === "doctor" || user.role === "patient" ? <Presence person={selected} /> : null}</div>
                <div className="product-chat-head-actions">
                  {user.role === "patient" && <><Link className="ghost-btn" to="/appointments"><CalendarDays size={15} /> Book</Link><Link className="secondary-btn" to={`/video?with=${selected.id}`}><Video size={15} /> Video</Link></>}
                  {user.role === "doctor" && selected.role === "patient" && <><Link className="ghost-btn" to={`/records/${selected.id}`}><FileText size={15} /> Chart</Link><Link className="secondary-btn" to={`/video?with=${selected.id}`}><Video size={15} /> Video</Link></>}
                  <button className="icon-btn" type="button" title="Conversation options"><MoreHorizontal size={18} /></button>
                </div>
              </header>

              <div className="product-message-thread">
                <div className="thread-date-marker"><span>Secure CareBridge conversation</span></div>
                {messages.length === 0 && <EmptyPlate compact scene="messages" icon={MessageCircle} title="No messages yet" hint={`Start the conversation with ${selected.name.split(" ")[0]}.`} />}
                {messages.map((message) => (
                  <div key={message.id} className={`product-bubble-row ${message.senderId === user.id ? "mine" : "theirs"}`}>
                    {message.senderId !== user.id && <Avatar person={selected} className="small" />}
                    <div className="product-bubble"><p>{message.text}</p><small>{prettyTime(message.timestamp)}</small></div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <form className="product-message-composer" onSubmit={(event) => { event.preventDefault(); sendText(text); }}>
                <input type="file" hidden ref={fileRef} onChange={onFile} />
                <button type="button" className="icon-btn" title="Attach a file" onClick={() => fileRef.current?.click()}><Paperclip size={18} /></button>
                <textarea rows="1" placeholder={selected.available === false && user.role === "patient" ? `${selected.name.split(" ")[0]} is busy — leave a secure message` : "Write a secure message…"} value={text} onChange={(event) => setText(event.target.value)} />
                <button className="send-btn" type="submit" aria-label="Send message"><Send size={18} /></button>
              </form>
            </>
          ) : <EmptyPlate scene="messages" icon={MessageCircle} title="Choose a conversation" hint="Select a person from the left to open the secure thread." />}
        </section>

        <aside className="product-chat-context">
          {selected ? (
            <>
              <div className="chat-context-image" style={{ backgroundImage: `url(${selected.role === "doctor" || user.role === "doctor" ? IMAGERY.clinic : IMAGERY.consult})` }}><span>{selected.role === "doctor" ? "Clinical contact" : "Care context"}</span></div>
              <div className="chat-context-person"><Avatar person={selected} className="large" /><h3>{selected.name}</h3><p>{selected.specialty || selected.role || "Care contact"}</p>{selected.role === "doctor" ? <Presence person={selected} /> : null}</div>
              <div className="chat-context-actions">
                {user.role === "patient" && <><Link to="/appointments"><CalendarDays size={16} /><span><b>Book appointment</b><small>Schedule care with this clinician</small></span></Link><Link to={`/video?with=${selected.id}`}><Video size={16} /><span><b>Start video</b><small>Open private consult room</small></span></Link></>}
                {user.role === "doctor" && selected.role === "patient" && <><Link to={`/records/${selected.id}`}><FileText size={16} /><span><b>Open chart</b><small>Clinical record and history</small></span></Link><Link to={`/video?with=${selected.id}`}><Video size={16} /><span><b>Teleconsult</b><small>Open consultation room</small></span></Link></>}
                {user.role === "nurse" && <div className="chat-context-note"><Stethoscope size={16} /><span><b>Clinical-only contact</b><small>Patient messaging is restricted for pharmacy nurses.</small></span></div>}
              </div>
              <div className="chat-context-security"><ShieldCheck size={16} /><div><b>Protected conversation</b><small>Messages use authenticated CareBridge identities and real-time room membership.</small></div></div>
            </>
          ) : <EmptyPlate compact scene="messages" title="Conversation context" hint="Contact details and care actions appear here." />}
        </aside>
      </div>

      {user.role === "doctor" && selected?.role === "patient" && <section className="product-section top-gap clinical-message-tools"><div className="product-section-head"><div><span className="eyebrow">Clinical action</span><h2>Prescription workspace</h2></div></div><RxPad patient={selected} source="messages" onIssued={(rx) => sendText(`Issued a prescription: ${rx.drug}. Open Prescriptions to print, buy on site, or collect at Ridge pharmacy.`)} /></section>}
    </div>
  );
}
