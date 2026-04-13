require('dotenv').config();
const { sendDenialEmail } = require('../server/email');

async function testDenial() {
    console.log('Testing sendDenialEmail...');
    try {
        await sendDenialEmail('venu.vallepu.engineer@gmail.com', {
            customerName: 'Test Customer',
            appointmentDate: '2026-05-10',
            appointmentTime: '10:00',
            reason: 'Staff on leave'
        });
        console.log('Denial email sent successfully!');
    } catch (error) {
        console.error('Failed to send denial email:', error);
    }
}

testDenial();
