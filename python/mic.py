# mic.py
import speech_recognition as sr
import requests
import sounddevice as sd
import numpy as np
import io
import scipy.io.wavfile as wav
import socket
import time
import openai

# ---------------- CONFIG ----------------
openai.api_key = ""  # Put your API key here
WEBHOOK_URL = None  # Not used, OpenAI API used directly
SAMPLE_RATE = 16000
WAKE_WORDS = ["hello", "hey", "start", "computer", "buddy", "hi", "smart mirror"]
SOCKET_HOST = 'localhost'
SOCKET_PORT = 9999
# ----------------------------------------

recognizer = sr.Recognizer()

# ---------------- UTILS ----------------
def send_to_node(message):
    """Send message to Electron app via TCP with retry"""
    while True:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((SOCKET_HOST, SOCKET_PORT))
            sock.send(message.encode('utf-8'))
            sock.close()
            break
        except Exception as e:
            print("Socket error:", e)
            time.sleep(1)

def record_audio(duration):
    print(f"? Recording for {duration} seconds...")
    audio = sd.rec(int(SAMPLE_RATE * duration), samplerate=SAMPLE_RATE, channels=1, dtype='int16')
    sd.wait()
    return np.squeeze(audio)

def audio_data_from_numpy(np_audio):
    byte_io = io.BytesIO()
    wav.write(byte_io, SAMPLE_RATE, np_audio)
    byte_io.seek(0)
    return sr.AudioFile(byte_io)

def listen(duration=4):
    np_audio = record_audio(duration)
    with audio_data_from_numpy(np_audio) as source:
        audio = recognizer.record(source)
    try:
        return recognizer.recognize_google(audio).lower()
    except sr.UnknownValueError:
        return ""
    except Exception as e:
        print("Recognition Error:", e)
        return ""

def ask_openai(question):
    """Call OpenAI Chat API and return response"""
    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": question}
            ],
            temperature=0.7,
            max_tokens=200
        )
        reply = response.choices[0].message.content.strip()
        return reply
    except Exception as e:
        print("? OpenAI API Error:", e)
        return "Sorry, I couldn't get a response from the AI."

# ---------------- MAIN LOOP ----------------
while True:
    print("Say a wake word...")
    text = listen(duration=2)
    print("Heard:", text)

    if any(wake_word in text for wake_word in WAKE_WORDS):
        print("Wake word detected. You have 10 seconds to speak.")
        send_to_node("mic-start")

        question = listen(duration=10)
        print("You asked:", question)
        if question:
            send_to_node(f"user:{question}")

        # Get AI response
        reply = ask_openai(question)
        print("? Bot:", reply)
        send_to_node(f"bot:{reply}")

        send_to_node("mic-end")
