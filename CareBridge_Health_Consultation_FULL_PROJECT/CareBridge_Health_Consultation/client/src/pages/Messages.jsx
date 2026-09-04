import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, Paperclip, Search, UserPlus, Video, CalendarDays } from "lucide-react";
import { io } from "socket.io-client";
import { Link, useSearchParams } from "react-router-dom";
import { api, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { roomIdFor } from "../utils";
import Avatar from "../components/Avatar";
import Presence from "../components/Presence";
import RxPad from "../components/RxPad";

const prettyTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
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
  const endRef = useRef();
  const fileRef = useRef();
  const socketRef = useRef();

  const loadContacts = (keepId) => {
    api(`/contacts?userId=${user.id}&role=${user.role}`).then((list) => {
      const rows = user.role === "nurse"
        ? (list || []).filter((c) => c.role === "doctor" || c.role === "admin")
        : list;
      setContacts(rows);
      const wanted = keepId || params.get("with");
      setSelected((cur) => rows.find((c) => c.id === (wanted || cur?.id)) || (wanted ? rows.find((c) => c.id === wanted) : rows[0]) || null);
    });
  };

  useEffect(() => {
    loadContacts();
    const socket = io(socketUrl, { autoConnect: true });
    socket.emit("join-user", user.id);
    socket.on("doctor-status", (p) => {
      setContacts((list) => list.map((c) => (c.id === p.id ? { ...c, available: p.available, photo: p.photo || c.photo } : c)));
      setSelected((cur) => (cur?.id === p.id ? { ...cur, available: p.available, photo: p.photo || cur.photo } : cur));
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
    if (!roomId || !socketRef.current) return;
    socketRef.current.emit("join-room", roomId);
    api(`/messages/${roomId}?userId=${user.id}`).then(setMessages);
    const handler = (m) => {
      if (m.roomId === roomId) setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setContacts((list) => list.map((c) => {
        const other = m.roomId?.split("-").find((id) => id !== user.id);
        if (c.id !== other) return c;
        return { ...c, lastMessage: { text: m.text, timestamp: m.timestamp, senderId: m.senderId } };
      }));
    };
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

  const visible = useMemo(
    () => contacts.filter((c) => `${c.name} ${c.specialty || ""}`.toLowerCase().includes(query.toLowerCase())),
    [contacts, query]
  );

  const copy = user.role === "patient"
    ? {
      title: "Messages",
      heading: "Chat with your doctors",
      blurb: "Only doctors you add appear here. Tap Add a doctor to see who is available or busy, with their photo and specialty.",
      emptyList: "No doctors in your chats yet",
      emptyListHint: "Add a doctor from the hospital list. You will see who is available or busy.",
      emptyChat: "Add a doctor to start chatting",
    }
    : user.role === "doctor"
      ? {
        title: "Clinical inbox",
        heading: "Patient messages",
        blurb: "Reply in the thread. Patients also get an email when you write.",
        emptyList: "No conversations",
        emptyListHint: "Open a patient chart or wait for a message.",
        emptyChat: "Select a conversation",
      }
      : user.role === "nurse"
        ? {
          title: "Pharmacy inbox",
          heading: "Consultants and operations",
          blurb: "Write to consultants and operations.",
          emptyList: "No consultants yet",
          emptyListHint: "Doctors and operations staff appear here. Patients are not listed.",
          emptyChat: "Select a consultant or operations contact",
        }
        : {
          title: "Switchboard",
          heading: "Hospital mail",
          blurb: "Route messages across the hospital.",
          emptyList: "No conversations",
          emptyListHint: "Open a patient chart or wait for a message.",
          emptyChat: "Select a conversation",
        };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">{copy.title}</span>
          <h1>{copy.heading}</h1>
          <p>{copy.blurb}</p>
        </div>
        {user.role === "patient" && (
          <Link className="primary-btn" to="/care?from=messages"><UserPlus size={16} /> Add a doctor</Link>
        )}
      </div>
      <div className="chat-layout">
        <aside className="contact-panel">
          <div className="search-box"><Search size={17} /><input placeholder="Search chats" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          {user.role === "patient" && (
            <Link className="secondary-btn full" style={{ margin: "8px 0 12px" }} to="/care?from=messages">
              <UserPlus size={16} /> Add a doctor
            </Link>
          )}
          {visible.map((c) => (
            <button key={c.id} onClick={() => setSelected(c)} className={`contact ${selected?.id === c.id ? "selected" : ""}`}>
              <span className="avatar-wrap">
                <Avatar person={c} />
                <i className={`online-dot ${c.available === false ? "busy" : "on"}`} />
              </span>
              <span>
                <b>{c.name}</b>
                <small>{c.lastMessage?.text || c.specialty || c.role || "Tap to write"}</small>
              </span>
                {c.unread > 0 && <em className="nav-badge">{c.unread}</em>}
                {c.lastMessage?.timestamp && <em className="chat-time">{prettyTime(c.lastMessage.timestamp)}</em>}
            </button>
          ))}
          {visible.length === 0 && (
            <div className="empty compact">
              <MessageCircle size={28} />
              <h3>{copy.emptyList}</h3>
              <p>{copy.emptyListHint}</p>
            </div>
          )}
        </aside>
        <section className="chat-panel">
          {selected ? (
            <>
              <div className="chat-head">
                <Avatar person={selected} />
                <div className="grow">
                  <strong>{selected.name}</strong>
                  <span className="muted">{selected.specialty || selected.city || "Care contact"}</span>
                  {selected.role === "doctor" || user.role === "patient" ? <Presence person={selected} /> : null}
                </div>
                {user.role === "patient" && (
                  <div className="row-actions">
                    <Link className="ghost-btn" to={`/appointments`}><CalendarDays size={16} /> Book</Link>
                    <Link className="secondary-btn" to={`/video?with=${selected.id}`}><Video size={16} /> Video</Link>
                  </div>
                )}
                {user.role === "doctor" && selected.role === "patient" && (
                  <div className="row-actions">
                    <Link className="ghost-btn" to={`/records/${selected.id}`}>Chart</Link>
                    <Link className="secondary-btn" to={`/video?with=${selected.id}`}><Video size={16} /> Video</Link>
                  </div>
                )}
              </div>
              <div className="messages">
                {messages.length === 0 && (
                  <div className="empty compact">
                    <MessageCircle size={32} />
                    <h3>No messages yet</h3>
                    <p>Say hello. {selected.name.split(" ")[0]} will see this instantly{user.role === "patient" ? ", and by email if alerts are on" : ""}.</p>
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`bubble-wrap ${m.senderId === user.id ? "mine" : ""}`}>
                    <div className="bubble">{m.text}<small>{prettyTime(m.timestamp)}</small></div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <form className="message-composer" onSubmit={(e) => { e.preventDefault(); sendText(text); }}>
                <input type="file" hidden ref={fileRef} onChange={onFile} />
                <button type="button" className="icon-btn" title="Attach a file" onClick={() => fileRef.current?.click()}><Paperclip size={19} /></button>
                <input placeholder={selected.available === false && user.role === "patient" ? `${selected.name.split(" ")[0]} is busy — you can still leave a message` : "Write a message..."} value={text} onChange={(e) => setText(e.target.value)} />
                <button className="send-btn" type="submit"><Send size={18} /></button>
              </form>
            </>
          ) : (
            <div className="empty">
              <MessageCircle />
              <h3>{copy.emptyChat}</h3>
              {user.role === "patient" && <Link className="primary-btn" to="/care?from=messages"><UserPlus size={16} /> View available doctors</Link>}
            </div>
          )}
        </section>
      </div>
      {user.role === "doctor" && selected?.role === "patient" && (
        <div className="card top-gap">
          <RxPad
            patient={selected}
            source="messages"
            onIssued={(rx) => sendText(`Issued a prescription: ${rx.drug}. Open Prescriptions to print, buy on site, or collect at Ridge pharmacy.`)}
          />
        </div>
      )}
    </div>
  );
}
