import { useState, useRef, useEffect } from 'react';
import './App.css';

const BACKEND_URL = "http://127.0.0.1:5000"; // Update this to your backend address

function App() {
  const [messages, setMessages] = useState([
    {
      message: "Hi I am SketchAgent, I love to sketch. Let me know what you'd like me to draw!",
      sender: "AI",
      direction: "incoming",
      isOldConversation: false,
    },
  ]);

  const [currentMessage, setCurrentMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [currentSketch, setCurrentSketch] = useState(null);
  const [currentConcept, setCurrentConcept] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  // Initialize canvas
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;

      // Make canvas responsive
      const resizeCanvas = () => {
        const container = canvas.parentElement;
        const containerWidth = container.offsetWidth;
        const aspectRatio = 4 / 3; // Standard aspect ratio

        // Set a minimum size to ensure visibility
        const minWidth = 400;
        const width = containerWidth > minWidth ? (containerWidth > 800 ? 800 : containerWidth - 30) : minWidth;
        const height = width / aspectRatio;

        canvas.width = width;
        canvas.height = height;

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Set up drawing context
        const context = canvas.getContext("2d");
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = 3;
        contextRef.current = context;
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, []);

  // Display image when currentSketch changes
  useEffect(() => {
    if (currentSketch && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      // Clear canvas first
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Draw new image
      const img = new Image();
      img.onload = () => {
        // Calculate scaling to fit the canvas while maintaining aspect ratio
        const scale = Math.min(
          canvas.width / img.width,
          canvas.height / img.height
        );

        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;

        context.drawImage(img, x, y, img.width * scale, img.height * scale);
      };

      // Add timestamp to prevent caching
      img.src = `${currentSketch}?t=${new Date().getTime()}`;
    }
  }, [currentSketch]);

  const clearCanvas = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    setCurrentSketch(null);
    setCurrentConcept("");
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = {
      message: currentMessage,
      sender: "user",
      direction: "outgoing",
      isOldConversation: false,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    const userInput = currentMessage;
    setCurrentMessage("");

    // Indicate AI is thinking
    setTyping(true);

    try {
      // If this is the first message or a new sketch request
      if (!currentSketch || userInput.toLowerCase().includes("draw") || userInput.toLowerCase().includes("sketch")) {
        // Extract concept from message
        let concept = userInput;
        if (userInput.toLowerCase().includes("draw")) {
          concept = userInput.toLowerCase().split("draw")[1].trim();
        } else if (userInput.toLowerCase().includes("sketch")) {
          concept = userInput.toLowerCase().split("sketch")[1].trim();
        }

        // Remove any punctuation at the end
        concept = concept.replace(/[.,!?]$/, "");

        if (concept) {
          setCurrentConcept(concept);
          // Call backend to generate sketch
          await generateSketch(concept);

          setMessages([...newMessages, {
            message: `Here's my sketch of "${concept}". What would you like me to modify?`,
            sender: "AI",
            direction: "incoming",
            isOldConversation: false,
          }]);
        } else {
          setMessages([...newMessages, {
            message: "What would you like me to draw? Please specify a concept.",
            sender: "AI",
            direction: "incoming",
            isOldConversation: false,
          }]);
        }
      }
      // If it's a modification request
      else if (currentSketch) {
        // Call backend to modify sketch
        await modifySketch(currentConcept, userInput);

        setMessages([...newMessages, {
          message: `I've updated the ${currentConcept} sketch based on your feedback. How does it look now?`,
          sender: "AI",
          direction: "incoming",
          isOldConversation: false,
        }]);
      }
    } catch (error) {
      console.error("Error communicating with SketchAgent:", error);
      setMessages([...newMessages, {
        message: "Sorry, I encountered an error while creating the sketch. Please try again.",
        sender: "AI",
        direction: "incoming",
        isOldConversation: false,
      }]);
    } finally {
      setTyping(false);
      setIsRegenerating(false);
    }
  };

  const handleRegenerateResponse = async () => {
    // Find the last AI message and user message
    const lastAIMessageIndex = [...messages].reverse().findIndex(msg => msg.sender === "AI");
    const lastUserMessageIndex = [...messages].reverse().findIndex(msg => msg.sender === "user");

    if (lastUserMessageIndex === -1) return; // No user message to regenerate from

    const lastUserMessage = messages[messages.length - 1 - lastUserMessageIndex];

    // Set regenerating state
    setIsRegenerating(true);
    setTyping(true);

    // Remove the last AI message if it exists
    const updatedMessages = lastAIMessageIndex !== -1
      ? messages.slice(0, messages.length - 1 - lastAIMessageIndex)
      : [...messages];

    setMessages(updatedMessages);

    // Re-process the last user message
    try {
      const userInput = lastUserMessage.message;

      if (currentSketch && !userInput.toLowerCase().includes("draw") && !userInput.toLowerCase().includes("sketch")) {
        // Regenerate modification
        await modifySketch(currentConcept, userInput);

        setMessages([...updatedMessages, {
          message: `I've created a new version of the ${currentConcept} sketch based on your feedback. How does this one look?`,
          sender: "AI",
          direction: "incoming",
          isOldConversation: false,
        }]);
      } else {
        // Extract concept for a new sketch
        let concept = userInput;
        if (userInput.toLowerCase().includes("draw")) {
          concept = userInput.toLowerCase().split("draw")[1].trim();
        } else if (userInput.toLowerCase().includes("sketch")) {
          concept = userInput.toLowerCase().split("sketch")[1].trim();
        }

        concept = concept.replace(/[.,!?]$/, "");

        if (concept) {
          setCurrentConcept(concept);
          await generateSketch(concept);

          setMessages([...updatedMessages, {
            message: `I've created a new sketch of "${concept}". What do you think of this version?`,
            sender: "AI",
            direction: "incoming",
            isOldConversation: false,
          }]);
        }
      }
    } catch (error) {
      console.error("Error regenerating response:", error);
      setMessages([...updatedMessages, {
        message: "Sorry, I encountered an error while regenerating the sketch. Please try again.",
        sender: "AI",
        direction: "incoming",
        isOldConversation: false,
      }]);
    } finally {
      setTyping(false);
      setIsRegenerating(false);
    }
  };

  const generateSketch = async (concept) => {
    try {
      // Call backend to generate sketch
      const response = await fetch(`${BACKEND_URL}/generate-sketch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ concept }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate sketch');
      }

      const data = await response.json();
      console.log("Response from backend:", data);

      // Set the currentSketch
      if (data.image_path && !data.image_path.startsWith('http')) {
        setCurrentSketch(`${BACKEND_URL}/${data.image_path}`);
      } else {
        setCurrentSketch(data.image_path);
      }
    } catch (error) {
      console.error("Error generating sketch:", error);
      throw error;
    }
  };

  const modifySketch = async (concept, modification) => {
    try {
      const response = await fetch(`${BACKEND_URL}/edit-sketch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          concept,
          objects_to_add: [modification],  // Format as array of objects to add
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to modify sketch');
      }

      const data = await response.json();

      // Set the image path for later use
      if (data.image_path && !data.image_path.startsWith('http')) {
        setCurrentSketch(`${BACKEND_URL}/${data.image_path}`);
      } else {
        setCurrentSketch(data.image_path);
      }
    } catch (error) {
      console.error("Error modifying sketch:", error);
      throw error;
    }
  };

  const handleDownload = () => {
    if (currentSketch) {
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = currentSketch;
      link.download = `sketch-${currentConcept.replace(/\s+/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (canvasRef.current) {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.download = 'sketch-agent-drawing.png';
      link.href = dataUrl;
      link.click();
    }
  };

  const handleShare = () => {
    alert("Sharing functionality would be implemented here.");
  };

  return (
    <div className="app">
      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="logo-container">
            <img
              src="sketchagent_logo.png"
              alt="SketchAgent Logo"
              className="header-logo"
            />
            <div className="logo">
              <span className="logo-light">Sketch</span>
              <span className="logo-dark">Agent</span>
            </div>
            <button className="draw-button">✏️</button>
          </div>

          <div className="title-bar">
            <div className="title-content">
              {currentConcept ? (
                <span>SketchAgent: Drawing {currentConcept}</span>
              ) : (
                <span>SketchAgent: Ready to draw</span>
              )}
            </div>

            <div className="action-buttons">
              <button
                className="action-button"
                onClick={clearCanvas}
                title="Clear Canvas"
              >
                🗑️
              </button>
              <button
                className="action-button"
                onClick={handleDownload}
                title="Download Sketch"
              >
                ⬇️
              </button>
              <button
                className="action-button"
                onClick={handleShare}
                title="Share Sketch"
              >
                🔗
              </button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="main-content">
          {/* Canvas area */}
          <div className="canvas-area">
            {/* Canvas */}
            <div className="canvas-container">
              <canvas
                ref={canvasRef}
                className="drawing-canvas"
              />
            </div>
          </div>

          {/* Right sidebar */}
          <div className="sidebar">
            {/* Messages */}
            <div className="messages-container">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message ${msg.sender === "AI" ? "message-ai" : "message-user"} ${msg.isOldConversation ? "message-old" : ""}`}
                >
                  {msg.message}

                  {msg.sender === "AI" && !msg.isOldConversation && (
                    <div className="regenerate-button-container">
                      <button
                        className="regenerate-button"
                        onClick={handleRegenerateResponse}
                        disabled={isRegenerating}
                      >
                        🔄 {isRegenerating ? "Regenerating..." : "Regenerate"}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {typing && (
                <div className="message message-ai">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>

            {/* Message input */}
            <div className="message-input-wrapper" style={{
              padding: '15px',
              borderTop: '1px solid #e0e0e0',
              backgroundColor: '#f8f9fa',
              marginTop: 'auto', // Pushes the input to the bottom
            }}>
              <div className="message-input-container" style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
              }}>
                <input
                  type="text"
                  className="message-input"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder={currentSketch ? "Tell me how to modify the sketch..." : "Ask me to draw something..."}
                  style={{
                    width: '100%',
                    padding: '12px 15px',
                    borderRadius: '20px',
                    border: '1px solid #e0e0e0',
                    fontSize: '14px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  style={{
                    marginLeft: '-10px',
                    background: 'none',
                    border: 'none',
                    color: '#4a90e2',
                    fontSize: '20px',
                    cursor: 'pointer',
                  }}
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
