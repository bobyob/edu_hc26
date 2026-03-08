Why MyFocusFriend? The Canadian Context
In 2025–2026, the Canadian educational landscape faces a "triple threat" that makes traditional study apps insufficient:

The Focus Crisis: Recent studies show that 89% of post-secondary students in Canada report feeling overwhelmed, with digital distractions (phones/social media) being a primary barrier to deep work.

Mental Health Gaps: Over 75% of Canadian students report struggling with mental health, yet nearly half find university support services difficult to access or wait-listed.

The Loneliness Epidemic: With the rise of hybrid and remote learning in provinces like Ontario and BC, many students study in total isolation, leading to high burnout rates and decreased motivation.

MyFocusFriend addresses these issues by providing a physical presence that mimics the support of a live tutor or study group, helping students stay grounded and regulated.

🌟 The Core Experience
The centerpiece is the Physical Study Buddy—a unique hardware shell housing a Raspberry Pi. It isn't just a gadget; it is a designed companion that offers:

Live Emotional Mirroring: Using a React camera feed and OpenCV, the system monitors the student’s face. When frustration is detected (a common precursor to "giving up" in tough Canadian STEM modules), the Raspberry Pi reacts.

Dynamic Visuals: The Pi’s screen displays real-time "faces" (Happy, Sad, Frustrated, Neutral) to validate the student's feelings.

Humanized AI Speaker: An integrated speaker provides vocal encouragement—e.g., "You've got this! Let's take a 5-minute break and come back to this math problem."—humanizing the experience and breaking the cycle of isolation.

🚀 Key Technical Features
1. Adaptive Academic Modules
Subjects: Specialized curriculum for Math, Science, and English.

Dynamic Difficulty Scaling: A JSON-driven quiz engine monitors correctness. If a student answers two questions correctly, it scales up; if they struggle, it scales back to rebuild confidence, directly addressing the "boredom/frustration" drop-out risk cited in Canadian educational research.

2. Dual-Insight Dashboards
Student Summary: Displays a "Mood Dial" showing average emotional resilience during the session, total questions right, and scores.

Parent/Tutor Summary: Provides data on total session frequency and "next steps," allowing parents to act as "coaches" rather than critics.

🛠️ Technical Stack
Frontend: React, JavaScript, Tailwind CSS (High-fidelity Figma matching).

Backend: Python + Flask (Relays emotion data from the browser to the Raspberry Pi).

AI/ML: OpenCV for real-time facial analysis.

Hardware: Raspberry Pi (Dedicated screen + Audio output).
