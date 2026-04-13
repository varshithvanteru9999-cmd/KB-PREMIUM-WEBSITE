require('dotenv').config();
const nodemailer = require('nodemailer');

const config = {
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER || 'venu.vallepu.engineer@gmail.com',
        pass: process.env.SMTP_PASS || 'jtjm fwar wzzq lxhj',
    },
};

console.log('Testing SMTP with config:', { ...config, auth: { ...config.auth, pass: '****' } });

const transporter = nodemailer.createTransport(config);

async function testEmail() {
    try {
        console.log('Verifying transporter...');
        await transporter.verify();
        console.log('Transporter verified successfully!');

        const mailOptions = {
            from: `"KB Beauty Test" <${config.auth.user}>`,
            to: config.auth.user, // Send to self
            subject: 'KB Beauty - SMTP Test Connection',
            text: 'This is a test email from the KB Beauty server to verify SMTP connection.',
        };

        console.log('Sending test email to self...');
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        process.exit(0);
    } catch (error) {
        console.error('SMTP Error occurred:');
        console.error(error);
        process.exit(1);
    }
}

testEmail();
