from gpiozero import InputDevice
import socket
import time

# Connect IR sensor to GPIO17
ir_sensor = InputDevice(17)

last_state = None
last_change_time = time.time()

def send_state(state):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect(('localhost', 9999))
        sock.send(state.encode('utf-8'))
        sock.close()
    except Exception as e:
        print("Socket error:", e)

while True:
    if not ir_sensor.is_active:
        # No one detected => show screen
        if last_state != "show":
            send_state("show")
            last_state = "show"
            last_change_time = time.time()
    else:
        # Someone detected => wait 10s then hide
        if last_state == "show" and time.time() - last_change_time > 10:
            send_state("hide")
            last_state = "hide"
    time.sleep(0.5)
