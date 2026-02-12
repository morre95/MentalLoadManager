import Navbar from "../components/landing/Navbar";

const Contact = () => {
    const sendMessage = async () => {
        const response = await fetch("/api/contact/send/message");
        console.log(response)
    }

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <main>
                <p>HELLO FROM Contact</p>
                <button onClick={sendMessage}>Ckicka meddelande</button>
            </main>
        </div>
    );
};

export default Contact;

// React POST /contact to FastAPI with {name, email, message}
/*FastAPI:

validates input

stores it (optional but recommended)

sends you an email via provider (SendGrid/Mailgun/Resend/SES)

returns { ok: true }

Frontend shows toast success/failure*/