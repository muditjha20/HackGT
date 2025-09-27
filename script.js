// Enhanced scenario with more realistic dialogue and interactions
const SCENARIO_BUS_V1 = {
    turn1: {
        npc_line: "Hey! I paid my fare! This machine is broken and you're trying to cheat me!",
        passenger_line: "Hey! I paid my fare! This machine is broken and you're trying to cheat me!",
        driver_line: "Sir, the machine is working fine. Please step back and let other passengers board.",
        good_keywords: ["calm", "help", "understand", "issue", "problem", "assist", "check"],
        bad_keywords: ["shut up", "idiot", "stupid", "liar", "cheat", "sue", "fight"],
        branches: {
            STRONG: {
                npc_react: "The passenger takes a breath and explains more calmly: 'Okay, look, I swiped my card three times already.'",
                outcome: "cooling"
            },
            NEUTRAL: {
                npc_react: "The passenger scowls but lowers their voice slightly: 'Whatever, just drive the bus.'",
                outcome: "stall"
            },
            ESCALATE: {
                npc_react: "The passenger turns toward you aggressively: 'Who asked you? Mind your own business!'",
                outcome: "escalate"
            }
        }
    },
    turn2: {
        npc_line: "Why are you getting involved? This is between me and the driver!",
        passenger_line: "Why are you getting involved? This is between me and the driver!",
        driver_line: "Please everyone, remain calm. We can sort this out.",
        good_keywords: ["peace", "safe", "respect", "everyone", "understand", "help", "resolve"],
        bad_keywords: ["back off", "threaten", "yell", "police", "fight", "stupid", "shut up"],
        branches: {
            STRONG: {
                npc_react: "The passenger sighs and sits down: 'Fine, fine. I'll just take a seat. This isn't worth it.'",
                outcome: "cooling"
            },
            NEUTRAL: {
                npc_react: "The passenger mutters under their breath but stops confronting the driver directly.",
                outcome: "stall"
            },
            ESCALATE: {
                npc_react: "The passenger gets in your face: 'You want trouble? I'll give you trouble!'",
                outcome: "escalate"
            }
        }
    }
};

// App state with enhanced tracking
let appState = {
    currentTurn: 1,
    micEnabled: false,
    audioContext: null,
    analyser: null,
    mediaStream: null,
    recognition: null,
    isListening: false,
    gameData: {
        turn1: { response: "", tone: "", branch: "" },
        turn2: { response: "", tone: "", branch: "" }
    },
    npcAnimations: {
        angry: { rotation: { from: "0 0 -10", to: "0 0 10", dur: 500 } },
        calm: { rotation: { from: "0 0 -2", to: "0 0 2", dur: 2000 } }
    }
};

// DOM elements
const loadingScreen = document.getElementById('loadingScreen');
const micPermissionBtn = document.getElementById('micPermission');
const micStatus = document.getElementById('micStatus');
const hint = document.getElementById('hint');
const subtitle = document.getElementById('subtitle');
const responseButtons = document.getElementById('responseButtons');
const voiceInputSection = document.getElementById('voiceInputSection');
const speakNowBtn = document.getElementById('speakNowBtn');
const transcript = document.getElementById('transcript');
const feedbackCard = document.getElementById('feedbackCard');
const feedbackResponse = document.getElementById('feedbackResponse');
const feedbackTone = document.getElementById('feedbackTone');
const feedbackPositive = document.getElementById('feedbackPositive');
const feedbackSuggestion = document.getElementById('feedbackSuggestion');
const feedbackBetterLine = document.getElementById('feedbackBetterLine');
const saveCardBtn = document.getElementById('saveCardBtn');
const replayBtn = document.getElementById('replayBtn');
const exportCanvas = document.getElementById('exportCanvas');
const ctx = exportCanvas.getContext('2d');
const angryPassenger = document.getElementById('angryPassenger');
const busDriver = document.getElementById('busDriver');
const passengerBubble = document.getElementById('passengerBubble');
const driverBubble = document.getElementById('driverBubble');
const passengerText = document.getElementById('passengerText');
const driverText = document.getElementById('driverText');

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Hide loading screen after a short delay to ensure everything is loaded
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        // Start the scenario
        startTurn(1);
    }, 1500);
    
    // Set up event listeners
    micPermissionBtn.addEventListener('click', requestMicrophonePermission);
    
    // Set up A-Frame component for click handling
    AFRAME.registerComponent('click-handler', {
        init: function () {
            this.el.addEventListener('click', (evt) => {
                if (this.el.classList.contains('response-btn')) {
                    const choice = this.el.getAttribute('data-choice');
                    handleButtonResponse(choice);
                } else if (this.el.id === 'speakNowBtn') {
                    if (voiceInputSection.getAttribute('visible') === 'true' && appState.micEnabled) {
                        startVoiceInput();
                    }
                } else if (this.el.id === 'saveCardBtn') {
                    exportFeedbackCard();
                } else if (this.el.id === 'replayBtn') {
                    resetGame();
                }
            });
        }
    });
    
    // Apply click handler to all interactive elements
    const clickableElements = document.querySelectorAll('.clickable');
    clickableElements.forEach(el => {
        el.setAttribute('click-handler', '');
    });
    
    // Set up hover indicators for controllers
    setupHoverIndicators();
});

// Set up hover indicators for controllers
function setupHoverIndicators() {
    const controllers = document.querySelectorAll('[laser-controls]');
    controllers.forEach(controller => {
        controller.addEventListener('raycaster-intersection', function(event) {
            const hoverIndicator = controller.querySelector('.hover-indicator');
            if (event.detail.els.length > 0) {
                const intersection = event.detail.intersections[0];
                hoverIndicator.object3D.position.copy(intersection.point);
                hoverIndicator.setAttribute('visible', true);
            }
        });
        
        controller.addEventListener('raycaster-intersection-cleared', function(event) {
            const hoverIndicator = controller.querySelector('.hover-indicator');
            hoverIndicator.setAttribute('visible', false);
        });
    });
}

// Start a new turn with enhanced NPC interactions
function startTurn(turnNumber) {
    appState.currentTurn = turnNumber;
    const turnData = turnNumber === 1 ? SCENARIO_BUS_V1.turn1 : SCENARIO_BUS_V1.turn2;
    
    // Update UI
    subtitle.setAttribute('value', turnData.npc_line);
    responseButtons.setAttribute('visible', true);
    voiceInputSection.setAttribute('visible', appState.micEnabled);
    transcript.setAttribute('value', '');
    
    // Hide feedback card if visible
    feedbackCard.setAttribute('visible', false);
    feedbackCard.setAttribute('scale', '0 0 0');
    
    // Enhanced NPC interactions - Start the argument
    startNPCArgument(turnNumber);
}

// Start NPC argument with animations and speech
function startNPCArgument(turnNumber) {
    const turnData = turnNumber === 1 ? SCENARIO_BUS_V1.turn1 : SCENARIO_BUS_V1.turn2;
    
    // Reset NPC positions
    angryPassenger.setAttribute('position', '1 0 6');
    busDriver.setAttribute('position', '-2 0 8');
    
    if (turnNumber === 1) {
        // Show angry passenger animation
        angryPassenger.setAttribute('animation', {
            property: 'rotation',
            dur: '500',
            from: '0 0 -10',
            to: '0 0 10',
            direction: 'alternate',
            repeat: 'indefinite'
        });
        
        // Add aggressive movement animation
        angryPassenger.setAttribute('animation__move', {
            property: 'position',
            dur: '1000',
            from: '1 0 6',
            to: '0.8 0 5.8',
            direction: 'alternate',
            repeat: 'indefinite'
        });
        
        // Show passenger speech bubble
        passengerBubble.setAttribute('visible', true);
        passengerText.setAttribute('value', turnData.passenger_line);
        
        // Driver looks nervous with faster animation
        busDriver.setAttribute('animation', {
            property: 'rotation',
            dur: '800',
            from: '0 0 -5',
            to: '0 0 5',
            direction: 'alternate',
            repeat: 'indefinite'
        });
        
        // Driver responds after a delay
        setTimeout(() => {
            driverBubble.setAttribute('visible', true);
            driverText.setAttribute('value', turnData.driver_line);
            
            // Passenger gets more agitated after driver responds
            setTimeout(() => {
                angryPassenger.setAttribute('animation', {
                    property: 'rotation',
                    dur: '300',
                    from: '0 0 -15',
                    to: '0 0 15',
                    direction: 'alternate',
                    repeat: 'indefinite'
                });
            }, 2000);
        }, 1500);
    } else {
        // Turn 2: Passenger is now addressing the player more aggressively
        angryPassenger.setAttribute('animation', {
            property: 'rotation',
            dur: '400',
            from: '0 0 -15',
            to: '0 0 15',
            direction: 'alternate',
            repeat: 'indefinite'
        });
        
        // Move passenger closer to player
        angryPassenger.setAttribute('animation__move', {
            property: 'position',
            dur: '2000',
            from: '1 0 6',
            to: '0.5 0 5',
            direction: 'alternate',
            repeat: 'indefinite'
        });
        
        passengerBubble.setAttribute('visible', true);
        passengerText.setAttribute('value', turnData.passenger_line);
        
        // Driver tries to calm the situation
        setTimeout(() => {
            driverBubble.setAttribute('visible', true);
            driverText.setAttribute('value', turnData.driver_line);
        }, 1000);
    }
}

// Handle button response
function handleButtonResponse(choice) {
    // Map choice to sample response text
    const responseMap = {
        'Direct': "Can we please discuss this calmly? I'm sure there's a solution.",
        'Distract': "Excuse me, does anyone know what stop we're at? I think I'm lost.",
        'Delegate': "Driver, is there a transit authority number we can call to resolve this?"
    };
    
    const responseText = responseMap[choice] || choice;
    const tone = 'ASSERTIVE'; // Button responses are always assertive
    
    // Visual feedback for button click
    const clickedButton = document.querySelector(`[data-choice="${choice}"]`);
    if (clickedButton) {
        clickedButton.setAttribute('color', '#f1c40f'); // Highlight color
        setTimeout(() => {
            clickedButton.setAttribute('color', 
                choice === 'Direct' ? '#27ae60' : 
                choice === 'Distract' ? '#2980b9' : '#e67e22');
        }, 300);
    }
    
    // Evaluate the response
    evaluateResponse(responseText, tone, choice);
}

// Request microphone permission
function requestMicrophonePermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function(stream) {
                appState.micEnabled = true;
                appState.mediaStream = stream;
                micStatus.textContent = 'Microphone: Enabled';
                micPermissionBtn.textContent = 'Microphone Enabled';
                micPermissionBtn.style.background = 'rgba(0, 200, 0, 0.9)';
                
                initAudioContext(stream);
                initSpeechRecognition();
                voiceInputSection.setAttribute('visible', true);
            })
            .catch(function(err) {
                console.error('Error accessing microphone:', err);
                micStatus.textContent = 'Microphone: Access Denied';
            });
    } else {
        micStatus.textContent = 'Microphone: Not Supported';
    }
}

// Initialize audio context for tone analysis
function initAudioContext(stream) {
    appState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    appState.analyser = appState.audioContext.createAnalyser();
    const source = appState.audioContext.createMediaStreamSource(stream);
    source.connect(appState.analyser);
    appState.analyser.fftSize = 256;
}

// Initialize speech recognition
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        appState.recognition = new SpeechRecognition();
        appState.recognition.continuous = false;
        appState.recognition.interimResults = false;
        appState.recognition.lang = 'en-US';
        
        appState.recognition.onresult = function(event) {
            const transcriptText = event.results[0][0].transcript;
            transcript.setAttribute('value', `You said: ${transcriptText}`);
            analyzeTone(transcriptText);
        };
        
        appState.recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            transcript.setAttribute('value', 'Error: Could not understand speech');
            responseButtons.setAttribute('visible', true);
        };
        
        appState.recognition.onend = function() {
            appState.isListening = false;
            speakNowBtn.setAttribute('color', '#9b59b6');
        };
    } else {
        transcript.setAttribute('value', 'Speech recognition not supported');
    }
}

// Start voice input
function startVoiceInput() {
    if (appState.isListening) return;
    
    appState.isListening = true;
    speakNowBtn.setAttribute('color', '#e74c3c');
    transcript.setAttribute('value', 'Listening... Speak now.');
    
    // Hide buttons during voice input
    responseButtons.setAttribute('visible', false);
    
    if (appState.recognition) {
        appState.recognition.start();
    } else {
        // Fallback: simulate speech input after a delay
        setTimeout(function() {
            const sampleResponses = [
                "Can everyone please stay calm?",
                "Let's try to resolve this peacefully.",
                "I think there's been a misunderstanding."
            ];
            const randomResponse = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];
            transcript.setAttribute('value', `You said: ${randomResponse}`);
            analyzeTone(randomResponse);
        }, 2000);
    }
}

// Analyze tone from audio
function analyzeTone(transcriptText) {
    if (!appState.analyser) {
        evaluateResponse(transcriptText, 'ASSERTIVE', 'Voice');
        return;
    }
    
    const bufferLength = appState.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    setTimeout(function() {
        appState.analyser.getByteTimeDomainData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const sample = (dataArray[i] - 128) / 128;
            sum += sample * sample;
        }
        const rms = Math.sqrt(sum / bufferLength);
        
        let zeroCrossings = 0;
        for (let i = 1; i < bufferLength; i++) {
            if ((dataArray[i-1] < 128 && dataArray[i] >= 128) || 
                (dataArray[i-1] >= 128 && dataArray[i] < 128)) {
                zeroCrossings++;
            }
        }
        const zeroCrossingRate = zeroCrossings / bufferLength;
        
        let tone;
        if (rms < 0.25) {
            tone = 'CALM';
        } else if (rms <= 0.6) {
            tone = 'ASSERTIVE';
        } else {
            tone = 'AGGRESSIVE';
        }
        
        if (zeroCrossingRate > 0.3) {
            tone = 'AGGRESSIVE';
        }
        
        evaluateResponse(transcriptText, tone, 'Voice');
    }, 1000);
}

// Evaluate the player's response with enhanced NPC reactions
function evaluateResponse(responseText, tone, inputMethod) {
    const turnData = appState.currentTurn === 1 ? SCENARIO_BUS_V1.turn1 : SCENARIO_BUS_V1.turn2;
    
    // Store game data
    appState.gameData[`turn${appState.currentTurn}`].response = responseText;
    appState.gameData[`turn${appState.currentTurn}`].tone = tone;
    
    // Keyword matching
    const lowerResponse = responseText.toLowerCase();
    let containsGoodKeyword = false;
    let containsBadKeyword = false;
    
    for (const keyword of turnData.good_keywords) {
        if (lowerResponse.includes(keyword.toLowerCase())) {
            containsGoodKeyword = true;
            break;
        }
    }
    
    for (const keyword of turnData.bad_keywords) {
        if (lowerResponse.includes(keyword.toLowerCase())) {
            containsBadKeyword = true;
            break;
        }
    }
    
    // Determine branch based on rules
    let branch;
    if (containsGoodKeyword && tone !== 'AGGRESSIVE') {
        branch = 'STRONG';
    } else if (tone === 'AGGRESSIVE' || containsBadKeyword) {
        branch = 'ESCALATE';
    } else {
        branch = 'NEUTRAL';
    }
    
    // Store branch result
    appState.gameData[`turn${appState.currentTurn}`].branch = branch;
    
    // Show NPC reaction with enhanced animations
    const npcReaction = turnData.branches[branch].npc_react;
    subtitle.setAttribute('value', npcReaction);
    
    // Update NPC animations based on outcome
    updateNPCReaction(branch);
    
    // Hide response options
    responseButtons.setAttribute('visible', false);
    voiceInputSection.setAttribute('visible', false);
    
    // Play appropriate sound
    playToneSound(branch);
    
    // Move to next turn or show feedback
    setTimeout(function() {
        if (appState.currentTurn === 1) {
            startTurn(2);
        } else {
            showFeedbackCard();
        }
    }, 4000);
}

// Update NPC reaction based on player's response
function updateNPCReaction(branch) {
    // Hide speech bubbles during reaction
    passengerBubble.setAttribute('visible', false);
    driverBubble.setAttribute('visible', false);
    
    if (branch === 'STRONG') {
        // Calmer animation
        angryPassenger.setAttribute('animation', {
            property: 'rotation',
            dur: '2000',
            from: '0 0 -5',
            to: '0 0 5',
            direction: 'alternate',
            repeat: 'indefinite'
        });
        
        // Move passenger back to original position
        angryPassenger.setAttribute('position', '1 0 6');
    } else if (branch === 'ESCALATE') {
        // More aggressive animation
        angryPassenger.setAttribute('animation', {
            property: 'rotation',
            dur: '300',
            from: '0 0 -20',
            to: '0 0 20',
            direction: 'alternate',
            repeat: 'indefinite'
        });
        
        // Move passenger closer to player for escalation
        angryPassenger.setAttribute('animation__move', {
            property: 'position',
            dur: '1000',
            from: '1 0 6',
            to: '0.3 0 4.5',
            direction: 'alternate',
            repeat: 'indefinite'
        });
        
        // Driver shows more concern
        busDriver.setAttribute('animation', {
            property: 'rotation',
            dur: '500',
            from: '0 0 -10',
            to: '0 0 10',
            direction: 'alternate',
            repeat: 'indefinite'
        });
    } else {
        // NEUTRAL - slight calming but still tense
        angryPassenger.setAttribute('animation', {
            property: 'rotation',
            dur: '1000',
            from: '0 0 -8',
            to: '0 0 8',
            direction: 'alternate',
            repeat: 'indefinite'
        });
    }
}

// Play a sound based on the branch outcome
function playToneSound(branch) {
    if (!appState.audioContext) {
        appState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const oscillator = appState.audioContext.createOscillator();
    const gainNode = appState.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(appState.audioContext.destination);
    
    if (branch === 'STRONG') {
        oscillator.frequency.setValueAtTime(523.25, appState.audioContext.currentTime);
    } else if (branch === 'NEUTRAL') {
        oscillator.frequency.setValueAtTime(392.00, appState.audioContext.currentTime);
    } else {
        oscillator.frequency.setValueAtTime(311.13, appState.audioContext.currentTime);
    }
    
    gainNode.gain.setValueAtTime(0.1, appState.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, appState.audioContext.currentTime + 0.5);
    
    oscillator.start(appState.audioContext.currentTime);
    oscillator.stop(appState.audioContext.currentTime + 0.5);
}

// Show feedback card at the end of the scenario
function showFeedbackCard() {
    // Hide NPC speech bubbles
    passengerBubble.setAttribute('visible', false);
    driverBubble.setAttribute('visible', false);
    
    // Determine overall outcome
    const turn1Outcome = SCENARIO_BUS_V1.turn1.branches[appState.gameData.turn1.branch].outcome;
    const turn2Outcome = SCENARIO_BUS_V1.turn2.branches[appState.gameData.turn2.branch].outcome;
    const isSuccess = turn1Outcome === 'cooling' || turn2Outcome === 'cooling';
    
    // Set feedback content based on outcome
    if (isSuccess) {
        feedbackResponse.setAttribute('value', `Response: "${appState.gameData.turn2.response}"`);
        feedbackTone.setAttribute('value', `Tone: ${appState.gameData.turn2.tone}`);
        feedbackPositive.setAttribute('value', '✓ You successfully de-escalated the situation');
        feedbackSuggestion.setAttribute('value', 'Continue using calm, clear communication in conflicts');
        feedbackBetterLine.setAttribute('value', 'Example: "Let\'s all take a breath and talk this through calmly"');
        
        // Success visual feedback
        feedbackCard.setAttribute('class', 'feedback-success');
    } else {
        feedbackResponse.setAttribute('value', `Response: "${appState.gameData.turn2.response}"`);
        feedbackTone.setAttribute('value', `Tone: ${appState.gameData.turn2.tone}`);
        feedbackPositive.setAttribute('value', '✓ You attempted to intervene safely');
        feedbackSuggestion.setAttribute('value', 'Work on maintaining calm under pressure; avoid aggressive language');
        feedbackBetterLine.setAttribute('value', 'Try: "I understand frustration, but let\'s find a peaceful solution"');
        
        // Neutral or escalate visual feedback
        if (turn2Outcome === 'escalate') {
            feedbackCard.setAttribute('class', 'feedback-escalate');
        } else {
            feedbackCard.setAttribute('class', 'feedback-neutral');
        }
    }
    
    // Show and animate the feedback card
    feedbackCard.setAttribute('visible', true);
    feedbackCard.setAttribute('scale', '1 1 1');
    
    // Reset NPC positions and animations to calm state
    angryPassenger.setAttribute('position', '1 0 6');
    angryPassenger.setAttribute('animation', {
        property: 'rotation',
        dur: '2000',
        from: '0 0 -5',
        to: '0 0 5',
        direction: 'alternate',
        repeat: 'indefinite'
    });
    
    busDriver.setAttribute('animation', {
        property: 'rotation',
        dur: '3000',
        from: '0 0 -2',
        to: '0 0 2',
        direction: 'alternate',
        repeat: 'indefinite'
    });
}

// Export feedback card as PNG
function exportFeedbackCard() {
    // Clear canvas
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    
    // Add title
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Bystander Coach - Training Feedback', exportCanvas.width / 2, 50);
    
    // Add response
    ctx.fillStyle = '#e74c3c';
    ctx.font = '20px Arial';
    wrapText(ctx, feedbackResponse.getAttribute('value'), exportCanvas.width / 2, 120, 700, 24);
    
    // Add tone
    ctx.fillStyle = '#3498db';
    ctx.font = '20px Arial';
    ctx.fillText(feedbackTone.getAttribute('value'), exportCanvas.width / 2, 180);
    
    // Add positive feedback
    ctx.fillStyle = '#27ae60';
    ctx.font = '20px Arial';
    wrapText(ctx, feedbackPositive.getAttribute('value'), exportCanvas.width / 2, 240, 700, 24);
    
    // Add suggestion
    ctx.fillStyle = '#e67e22';
    ctx.font = '20px Arial';
    wrapText(ctx, feedbackSuggestion.getAttribute('value'), exportCanvas.width / 2, 300, 700, 24);
    
    // Add better line
    ctx.fillStyle = '#9b59b6';
    ctx.font = '20px Arial';
    wrapText(ctx, feedbackBetterLine.getAttribute('value'), exportCanvas.width / 2, 360, 700, 24);
    
    // Add watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px Arial';
    ctx.fillText('Bystander Coach VR Training - Bus Conflict Scenario', exportCanvas.width / 2, exportCanvas.height - 30);
    
    // Create download link
    const link = document.createElement('a');
    link.download = 'bystander-coach-feedback.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}

// Helper function to wrap text on canvas
function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let testLine = '';
    let lineCount = 0;
    
    for (let i = 0; i < words.length; i++) {
        testLine = line + words[i] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && i > 0) {
            context.fillText(line, x, y);
            line = words[i] + ' ';
            y += lineHeight;
            lineCount++;
        } else {
            line = testLine;
        }
    }
    
    context.fillText(line, x, y);
}

// Reset the game to start over
function resetGame() {
    // Reset game state
    appState.currentTurn = 1;
    appState.gameData = {
        turn1: { response: "", tone: "", branch: "" },
        turn2: { response: "", tone: "", branch: "" }
    };
    
    // Hide feedback card
    feedbackCard.setAttribute('visible', false);
    feedbackCard.setAttribute('scale', '0 0 0');
    
    // Start over with turn 1
    startTurn(1);
}