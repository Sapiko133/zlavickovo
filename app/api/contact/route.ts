export async function POST(req: Request) {
  try {
    const { company, email, website, message } = await req.json();
    if (!company || !email || !message) {
      return Response.json({ ok: false, error: "Chýbajúce polia" }, { status: 400 });
    }

    const adminEmail = process.env.ADMIN_EMAIL ?? "";
    const resendKey = process.env.RESEND_API_KEY;
    const body = `Nová správa z formulára Inzercia:\n\nFirma: ${company}\nEmail: ${email}\nWeb: ${website || "—"}\n\nSpráva:\n${message}`;

    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Zlavickovo <noreply@zlavickovo.sk>",
          to: [adminEmail],
          subject: `Inzercia dopyt: ${company}`,
          text: body,
        }),
      });
    } else {
      console.log("[contact form]", body);
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
