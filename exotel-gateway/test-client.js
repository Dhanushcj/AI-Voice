const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:5050');

ws.on('open', () => {
    console.log('Test Client: Connected to Gateway.');

    // 1. Send Start Event
    ws.send(JSON.stringify({
        event: 'start',
        stream_sid: 'TEST_STREAM_123',
        call_sid: 'TEST_CALL_123'
    }));

    console.log('Test Client: Sent Start event. You should see "Stream started" in the server log.');
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.event === 'media') {
        console.log(`Test Client: Received AI Audio Response (Payload length: ${msg.media.payload.length})`);
    }
});

ws.on('close', () => {
    console.log('Test Client: Connection closed.');
});

ws.on('error', (err) => {
    console.error('Test Client Error:', err);
});
