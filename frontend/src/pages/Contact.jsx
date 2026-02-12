import { useState } from "react";
import Navbar from "../components/landing/Navbar";
import { GET_API_BASE_URL } from "../components/ui/base_url";

const API_BASE_URL = GET_API_BASE_URL();

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const body = new URLSearchParams();
    body.set("name", name);
    body.set("email", email);
    body.set("message", message);

    const response = await fetch(API_BASE_URL + "/api/contact/send/message", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email, message }),
});

const data = await response.json();
console.log(data)

    if (response.ok) {
      setName("");
      setEmail("");
      setMessage("");
    } else {
      alert("Something went wrong.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <p>HELLO FROM Contact</p>

        <form onSubmit={handleSubmit}>
          <label>Name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
          />

          <label>Email</label>
          <input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />

          <label>Message</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
          />

          <button type="submit">Send</button>
        </form>
      </main>
    </div>
  );
};

export default Contact;
