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
  const [drawingScale, setDrawingScale] = useState(100);
  const [typing, setTyping] = useState(false);
  const [currentSketch, setCurrentSketch] = useState(null);
  const [currentConcept, setCurrentConcept] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  const [strokeData, setStrokeData] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [animationCompleted, setAnimationCompleted] = useState(true);
  const animationRef = useRef(null);
  const [animationSpeed, setAnimationSpeed] = useState(100); // ms between strokes

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

  // Display image when currentSketch changes and animation is completed
  useEffect(() => {
    if (currentSketch && canvasRef.current && animationCompleted) {
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
  }, [currentSketch, animationCompleted]);

  const clearCanvas = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    setCurrentSketch(null);
    setCurrentConcept("");
    setStrokeData(null);
    setAnimationProgress(0);
    setAnimationCompleted(true);

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      setIsAnimating(false);
    }
  };

  const handleScaleChange = (e) => {
    setDrawingScale(parseInt(e.target.value));
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
      // Reset animation completed state
      setAnimationCompleted(false);

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

      // Set the currentSketch, but it won't display until animation completes
      if (data.image_path && !data.image_path.startsWith('http')) {
        setCurrentSketch(`${BACKEND_URL}/${data.image_path}`);
      } else {
        setCurrentSketch(data.image_path);
      }

      // Parse and set stroke data if available
      if (data.stroke_data) {
        console.log("Received stroke data:", data.stroke_data);

        // Parse the XML data
        const parsedData = parseStrokeData(data.stroke_data);
        console.log("Parsed stroke data:", parsedData);

        if (parsedData && parsedData.strokes && parsedData.strokes.length > 0) {
          setStrokeData(parsedData);

          // Automatically start animation after a short delay
          setTimeout(() => {
            startStrokeAnimation();
          }, 500);
          return;
        } else {
          console.error("Failed to parse stroke data or no strokes found");
        }
      }

      // If no stroke data, mark animation as completed to show static image
      setAnimationCompleted(true);
    } catch (error) {
      console.error("Error generating sketch:", error);
      setAnimationCompleted(true); // Show static image on error
      throw error;
    }
  };

  const startStrokeAnimation = () => {
    console.log("Starting animation with data:", strokeData);

    if (!strokeData || !canvasRef.current || isAnimating) {
      console.log("Cannot start animation:", {
        hasStrokeData: !!strokeData,
        hasCanvas: !!canvasRef.current,
        isAlreadyAnimating: isAnimating
      });
      setAnimationCompleted(true); // Show static image if animation can't start
      return;
    }

    // Set animation not completed to prevent static image from showing
    setAnimationCompleted(false);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Clear the canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Start animation
    animateDrawing(strokeData, ctx, canvas.width, canvas.height);
  };

  const modifySketch = async (concept, modification) => {
    try {
      // Reset animation completed state
      setAnimationCompleted(false);

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

      // Parse and set stroke data if available
      if (data.stroke_data) {
        console.log("Received stroke data for modified sketch:", data.stroke_data);

        // Parse the XML data
        const parsedData = parseStrokeData(data.stroke_data);
        console.log("Parsed stroke data:", parsedData);

        if (parsedData && parsedData.strokes && parsedData.strokes.length > 0) {
          setStrokeData(parsedData);

          // Automatically start animation after a short delay
          setTimeout(() => {
            startStrokeAnimation();
          }, 500);
          return;
        } else {
          console.error("Failed to parse stroke data or no strokes found for modification");
        }
      }

      // If no stroke data, mark animation as completed to show static image
      setAnimationCompleted(true);
    } catch (error) {
      console.error("Error modifying sketch:", error);
      setAnimationCompleted(true); // Show static image on error
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

  const renderAnimationControls = () => {
    if (!strokeData) return null;

    return (
      <div className="animation-controls">
        <button
          className="animation-button"
          onClick={startStrokeAnimation}
          disabled={isAnimating}
        >
          {isAnimating ? "Drawing..." : "Replay Animation"}
        </button>

        {isAnimating && (
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${animationProgress}%` }}
            ></div>
          </div>
        )}

        <div className="animation-speed-control">
          <label htmlFor="animation-speed">Speed: </label>
          <select
            id="animation-speed"
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(parseInt(e.target.value))}
            disabled={isAnimating}
          >
            <option value="50">Fast</option>
            <option value="100">Normal</option>
            <option value="200">Slow</option>
          </select>
        </div>
      </div>
    );
  };


  const parseStrokeData = (data) => {
    console.log("Raw stroke data received (full):", JSON.stringify(data, null, 2));

    try {
      // If data is already an object with strokes, use it directly
      if (typeof data === 'object' && data.strokes && data.strokes.length > 0) {
        console.log("Using directly passed stroke data");
        return data;
      }

      // Ensure data is a string
      let dataString = typeof data === 'string' ? data : JSON.stringify(data);
      dataString = dataString.trim();

      // More flexible parsing approach
      const strokes = [];
      const strokeRegex = /<s(\d+)>.*?<points>(.*?)<\/points>.*?<t_values>(.*?)<\/t_values>.*?<id>(.*?)<\/id>/gs;

      let match;
      while ((match = strokeRegex.exec(dataString)) !== null) {
        const [, strokeNum, pointsStr, tValuesStr, id] = match;

        // Parse points
        const points = pointsStr.split(',').map(point => {
          point = point.replace(/'/g, '').trim();
          const xMatch = point.match(/x(\d+)/);
          const yMatch = point.match(/y(\d+)/);
          return {
            x: xMatch ? parseInt(xMatch[1]) : 0,
            y: yMatch ? parseInt(yMatch[1]) : 0
          };
        }).filter(p => p.x !== 0 || p.y !== 0);

        // Parse t-values
        const tValues = tValuesStr.split(',').map(t => parseFloat(t.trim()));

        // Skip strokes with no points
        if (points.length === 0) continue;

        strokes.push({
          points,
          tValues: tValues.length > 0 ? tValues : points.map((_, i) => i / (points.length - 1)),
          id: id || `stroke_${strokeNum}`
        });
      }

      // If no strokes found through regex, try a more basic parsing
      if (strokes.length === 0) {
        // Split the data into potential strokes
        const potentialStrokes = dataString.split(/\n\s*\n/);

        potentialStrokes.forEach((strokeStr, index) => {
          const pointMatches = [...strokeStr.matchAll(/x(\d+)y(\d+)/g)];

          if (pointMatches.length > 0) {
            const points = pointMatches.map(match => ({
              x: parseInt(match[1]),
              y: parseInt(match[2])
            }));

            // Generate t-values
            const tValues = points.map((_, i) => i / (points.length - 1));

            strokes.push({
              points,
              tValues,
              id: `stroke_${index + 1}`
            });
          }
        });
      }

      // If still no strokes found, return fallback
      if (strokes.length === 0) {
        console.error("No strokes could be parsed from the data");
        return {
          concept: "fallback",
          strokes: [
            {
              points: [
                { x: 10, y: 10 },
                { x: 40, y: 10 },
                { x: 40, y: 40 },
                { x: 10, y: 40 },
                { x: 10, y: 10 }
              ],
              tValues: [0, 0.25, 0.50, 0.75, 1],
              id: "fallback_stroke"
            }
          ]
        };
      }

      console.log("Parsed strokes:", strokes);

      return {
        concept: "cup", // or extract from data if possible
        strokes
      };

    } catch (error) {
      console.error("Error parsing stroke data:", error);

      // Fallback to default if parsing fails
      return {
        concept: "fallback",
        strokes: [
          {
            points: [
              { x: 10, y: 10 },
              { x: 40, y: 10 },
              { x: 40, y: 40 },
              { x: 10, y: 40 },
              { x: 10, y: 10 }
            ],
            tValues: [0, 0.25, 0.50, 0.75, 1],
            id: "fallback_stroke"
          }
        ]
      };
    }
  };

  const animateDrawing = (strokeData, ctx, canvasWidth, canvasHeight) => {
    if (!strokeData || !strokeData.strokes || !ctx) {
      console.error("Invalid stroke data or context");
      setAnimationCompleted(true); // Show static image on error
      return;
    }

    // Clear any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Clear the canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Set animation state
    setIsAnimating(true);
    setAnimationProgress(0);

    // Define a fixed coordinate system for the drawing (assuming 50x50 grid)
    const maxCoord = 50;

    // Calculate scale to fit canvas based on the max coordinates
    const scaleX = canvasWidth / maxCoord;
    const scaleY = canvasHeight / maxCoord;
    const scale = Math.min(scaleX, scaleY) * 0.8; // 80% of available space to leave margins

    // Center the drawing on the canvas
    const offsetX = (canvasWidth - maxCoord * scale) / 2;
    const offsetY = (canvasHeight - maxCoord * scale) / 2;

    // Setup stroke style
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2 * scale / 10; // Scale line width proportionally
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const strokes = strokeData.strokes;
    let currentStrokeIndex = 0;
    let currentPointIndex = 0;
    const totalStrokes = strokes.length;

    // Count total points for progress calculation
    let totalPoints = 0;
    strokes.forEach(stroke => {
      if (stroke.points) {
        totalPoints += stroke.points.length - 1; // Count segments instead of points
      }
    });

    // Keep track of drawn points
    let drawnPoints = 0;

    const drawNextPoint = () => {
      if (currentStrokeIndex >= totalStrokes) {
        setIsAnimating(false);
        setAnimationProgress(100);

        // Mark animation as completed to trigger static image display
        setTimeout(() => {
          setAnimationCompleted(true);
        }, 500); // Short delay before showing static image
        return;
      }

      const currentStroke = strokes[currentStrokeIndex];
      if (!currentStroke || !currentStroke.points || currentStroke.points.length < 2) {
        // Skip invalid strokes
        currentStrokeIndex++;
        animationRef.current = requestAnimationFrame(drawNextPoint);
        return;
      }

      const points = currentStroke.points;

      if (currentPointIndex === 0) {
        // Start a new path for each stroke
        ctx.beginPath();

        // Move to the first point
        const firstPoint = points[0];
        const x = firstPoint.x * scale + offsetX;
        const y = firstPoint.y * scale + offsetY;
        ctx.moveTo(x, y);
      }

      if (currentPointIndex < points.length - 1) {
        // Draw line to the next point
        const nextPoint = points[currentPointIndex + 1];
        const x = nextPoint.x * scale + offsetX;
        const y = nextPoint.y * scale + offsetY;
        ctx.lineTo(x, y);
        ctx.stroke();

        currentPointIndex++;
        drawnPoints++;
      } else {
        // Move to the next stroke
        ctx.stroke();
        currentStrokeIndex++;
        currentPointIndex = 0;
        drawnPoints++;
      }

      // Update progress
      const progress = Math.min(100, Math.floor((drawnPoints / totalPoints) * 100));
      setAnimationProgress(progress);

      // Schedule next frame with a delay based on animation speed
      setTimeout(() => {
        animationRef.current = requestAnimationFrame(drawNextPoint);
      }, animationSpeed); // Use the selected animation speed
    };

    // Start animation
    animationRef.current = requestAnimationFrame(drawNextPoint);
  };

  const handleSpeedChange = (e) => {
    setAnimationSpeed(parseInt(e.target.value));
  };

  const handleReplayAnimation = () => {
    if (strokeData) {
      startStrokeAnimation();
    }
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
            {/* Canvas controls */}
            <div className="canvas-controls">
              <div className="control-group">
                <div className="scale-label">
                  Scale: {drawingScale}%
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={drawingScale}
                  onChange={handleScaleChange}
                  className="scale-slider"
                />
              </div>

              {strokeData && (
                <div className="animation-controls">
                  <button
                    className="animation-button"
                    onClick={handleReplayAnimation}
                    disabled={isAnimating}
                  >
                    {isAnimating ? "Drawing..." : "Replay Animation"}
                  </button>

                  {isAnimating && (
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar"
                        style={{ width: `${animationProgress}%` }}
                      ></div>
                    </div>
                  )}

                  <div className="animation-speed-control">
                    <label htmlFor="animation-speed">Speed: </label>
                    <select
                      id="animation-speed"
                      value={animationSpeed}
                      onChange={handleSpeedChange}
                      disabled={isAnimating}
                    >
                      <option value="50">Fast</option>
                      <option value="100">Normal</option>
                      <option value="200">Slow</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Canvas */}
            <div className="canvas-container">
              <canvas
                ref={canvasRef}
                className="drawing-canvas"
                style={{ transform: `scale(${drawingScale / 100})` }}
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
