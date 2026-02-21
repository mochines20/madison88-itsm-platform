const nodemailer = require('nodemailer');

(async () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;
  const to = process.env.TEST_TO || process.env.SMTP_USER;

  if (!user || !pass) {
    console.error('Missing SMTP_USER or SMTP_PASS environment variables');
    process.exit(2);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    tls: {
      // Allow self-signed certs for debugging; remove in production if not needed
      rejectUnauthorized: false,
    },
    logger: true,
    debug: true,
  });

  try {
    console.log('Verifying SMTP connection to', host + ':' + port);
    await transporter.verify();
    console.log('SMTP verified — sending test message to', to);

    const info = await transporter.sendMail({
      from,
      to,
      subject: 'Render SMTP test',
      text: 'This is a test email sent from the Render instance for SMTP troubleshooting.',
    });

    console.log('Message sent OK');
    console.log(info);
    process.exit(0);
  } catch (err) {
    console.error('SMTP test failed');
    console.error(err && err.stack ? err.stack : err);
    process.exit(3);
  }
})();
