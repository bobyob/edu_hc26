from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from deepface import DeepFace
import cv2
import numpy as np
import base64

app = FastAPI()

# This allows React to talk to Python without security blocks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImageData(BaseModel):
    image_base64: str

# Helper function to map base emotions to student learning states
def get_student_state(dominant_emotion):
    if dominant_emotion in ['angry', 'disgust']:
        return "frustrated"
    elif dominant_emotion == 'fear':
        return "anxious"
    elif dominant_emotion == 'surprise':
        return "surprised"
    elif dominant_emotion == 'sad':
        return "discouraged"
    elif dominant_emotion == 'happy':
        return "engaged"
    elif dominant_emotion == 'neutral':
        return "focused"
    return "unknown"

@app.post("/analyze")
async def analyze_emotion(data: ImageData):
    try:
        # Decode the image from React
        base64_string = data.image_base64
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]

        img_data = base64.b64decode(base64_string)
        np_arr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Could not decode image")

        # Analyze emotion
        analysis = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False)

        # Extract the dominant emotion and the raw percentage scores
        dominant_emotion = analysis[0]['dominant_emotion']
        emotion_scores = analysis[0]['emotion']

        # Get the custom student state
        student_state = get_student_state(dominant_emotion)

        # Return both the custom string and the raw score dictionary
        return {
            "emotion": student_state,
            "raw_scores": emotion_scores
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- LOCAL CAMERA TEST ---
# Run `python emotion_server.py` to trigger this block
if __name__ == "__main__":
    print("Starting local camera test... Press 'q' to quit.")

    # 1. Open the default webcam
    cap = cv2.VideoCapture(0)

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame from camera.")
            break

        try:
            # 2. Run the exact same AI logic used in your API
            analysis = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False)
            dominant_emotion = analysis[0]['dominant_emotion']

            # Map it to your custom student states
            student_state = get_student_state(dominant_emotion)

            # 3. Draw the detected learning state directly onto the video frame
            cv2.putText(frame, f"State: {student_state.upper()}", (30, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        except Exception as e:
            # Ignore temporary errors if it loses track of your face
            pass

        # 4. Show the video window
        cv2.imshow('Student Emotion Monitor Test', frame)

        # 5. Quit if the user presses 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Clean up and close the camera when done
    cap.release()
    cv2.destroyAllWindows()
