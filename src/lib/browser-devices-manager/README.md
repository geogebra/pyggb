# Still to do

What happens if the connection/open fails?  Currently you get `null`
in JS, which becomes `None` in Python.  Would an error be better?

If you request two devices, one after the other, and the user needs to
select them, then the second request fails because the call to
`requestDevice()` isn't directly in response to a user gesture.  MB
suggests having a separate UI step to **connect** to a device, after
which it *is* available directly to JavaScript, which would dodge the
problem.

Re-connecting to an already-permitted Bluetooth devices is not
implemented yet.  MB has provided sample code.

Would be nice to automatically understand HID reports by means of the
input report descriptor.  Is there code out there which already does
this?  Would save having to write individual drivers for every model
of joystick, gamepad, etc., out there.

Implement Serial devices.

Implement sending commands to devices, e.g., for a Circuit Playground
Express with suitable firmware.

Implement Web USB devices.

Tests!  This could be tricky; do we mock all the different types of
error and device we might get back from the browser?
