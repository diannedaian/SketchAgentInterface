# SketchAgent: Language-Driven Sequential Sketch Generation

<a href="https://yael-vinker.github.io/sketch-agent/"><img src="https://img.shields.io/static/v1?label=Project&message=Website&color=blue"></a>
<a href="https://www.apache.org/licenses/LICENSE-2.0.txt"><img src="https://img.shields.io/badge/License-Apache-yellow"></a>

<br>
<p align="center">
<img src="repo_images/teaser.jpg" width="90%"/>  
  
> <a href="">**SketchAgent: Language-Driven Sequential Sketch Generation**</a>
>
<a href="https://yael-vinker.github.io/website/" target="_blank">Yael Vinker</a>,
<a href="https://tamarott.github.io/" target="_blank">Tamar Rott Shaham</a>,
<a href="https://kristinezheng.github.io/" target="_blank">Kristine Zheng</a>,
<a href="https://www.linkedin.com/in/alex-zhao-a28b12176/" target="_blank">Alex Zhao</a>,
<a href="https://profiles.stanford.edu/judith-fan" target="_blank">Judith E Fan</a>,
<a href="https://groups.csail.mit.edu/vision/torralbalab/" target="_blank">Antonio Torralba</a>

> <br>
>  SketchAgent leverages an off-the-shelf multimodal LLM to facilitate language-driven, sequential sketch generation through an intuitive sketching language. It can sketch diverse concepts, engage in interactive sketching with humans, and edit content via chat.
</p>

## Overview

SketchAgent leverages an off-the-shelf multimodal LLM to facilitate language-driven, sequential sketch generation through an intuitive sketching language. This interface provides a user-friendly way to:

- Generate sketches from text descriptions
- Modify existing sketches through conversation
- Watch the drawing process animated stroke by stroke
- Download and share created sketches

## Setup and Installation

### Prerequisites

- Python 3.8 or later
- Node.js and npm
- Anthropic API key (for Claude access)

### Backend Setup

1. Clone the repository:
```bash
git clone https://github.com/your-username/sketchagent-interface.git
cd sketchagent-interface
```

2. Create and activate a conda environment:
```bash
conda env create -f environment.yml
conda activate sketch_agent
```

3. For Mac users, use the alternative environment file:
```bash
conda env create -f mac_environment.yml
conda activate sketch_agent
```

4. If you encounter warnings with cairosvg, reinstall it:
```bash
conda uninstall cairosvg && conda install cairosvg
```

5. Create a `.env` file in the root directory and add your Anthropic API key:
```
ANTHROPIC_API_KEY=<your_key>
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Running the Backend Server

From the root directory, start the Flask backend server:
```bash
python app.py
```

The server will run at `http://127.0.0.1:5000` by default.

### Running the Frontend

From the frontend directory, start the React development server:
```bash
npm start
```
or 
```bash
npm run dev
```

The application will be available at `http://localhost:3000`(or the http link in your terminal)

## How to Use

1. **Start a conversation**: Begin by asking SketchAgent to draw something, e.g., "Draw a cat" or "Sketch a sailboat"
2. **Watch the drawing process**: The sketch will be generated and you can replay the animation 
3. **Request modifications**: Continue the conversation to request changes, e.g., "Add a hat to the cat" or "Make the sailboat bigger"
4. **Control the animation**: Use the replay and speed controls to review the drawing process
5. **Download your creation**: Use the download button to save your sketch as a PNG

## How the Sketching Logic Works

SketchAgent uses a sequential stroke-based drawing approach:

1. **Text Processing**: When you request a sketch, your text is processed by a Claude LLM
2. **Stroke Generation**: Claude generates a series of strokes represented as points on a 50x50 grid
3. **SVG Conversion**: These points are converted to SVG paths with proper control points
4. **Rendering**: The SVG is rendered to the canvas and can be animated to show the drawing process
5. **Modification**: For edits, the existing sketch is passed back to the model along with your new instructions


## Citation

If you use SketchAgent in your research, please cite:

```bibtex
@misc{vinker2024sketchagent,
      title={SketchAgent: Language-Driven Sequential Sketch Generation}, 
      author={Yael Vinker and Tamar Rott Shaham and Kristine Zheng and Alex Zhao and Judith E Fan and Antonio Torralba},
      year={2024},
      eprint={2411.17673},
      archivePrefix={arXiv},
      primaryClass={cs.CV},
      url={https://arxiv.org/abs/2411.17673}, 
}
```
