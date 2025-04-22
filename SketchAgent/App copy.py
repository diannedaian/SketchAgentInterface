from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

import os
import json
import argparse
import traceback
from datetime import datetime
import uuid

# Import your SketchApp class
from gen_sketch import SketchApp


app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Store current sketches in memory
sketches = {}



def create_args_for_concept(concept):
    """Create args object similar to what argparse would create"""
    args = argparse.Namespace()

    # General
    args.concept_to_draw = concept
    args.seed_mode = 'deterministic'

    # Create unique folder with absolute path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    session_id = str(uuid.uuid4())[:8]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    args.path2save = os.path.join(current_dir, f"results/api_{timestamp}_{session_id}")

    args.model = 'claude-3-5-sonnet-20240620'
    args.gen_mode = 'generation'

    # Grid params
    args.res = 50
    args.cell_size = 12
    args.stroke_width = 7.0
    args.grid_size = (args.res + 1) * args.cell_size

    args.save_name = args.concept_to_draw.replace(" ", "_")
    args.path2save = os.path.join(args.path2save, args.save_name)

    if not os.path.exists(args.path2save):
        os.makedirs(args.path2save)
        with open(os.path.join(args.path2save, "experiment_log.json"), 'w') as json_file:
            json.dump([], json_file, indent=4)

    return args
@app.route('/generate-sketch', methods=['POST'])
def generate_sketch():
    try:
        data = request.get_json()
        concept = data.get('concept', '')

        if not concept:
            return jsonify({"error": "No concept provided"}), 400

        # Create args for SketchApp
        args = create_args_for_concept(concept)

        # Initialize SketchApp
        sketch_app = SketchApp(args)

        # Generate the sketch
        sketch_app.generate_sketch()

        # Get image path
        image_path = f"{args.path2save}/{args.save_name}.png"
        public_path = f"static/sketches/{args.save_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"

        # Copy to static folder for serving
        os.makedirs(os.path.dirname(f"static/sketches/"), exist_ok=True)

        # Use PIL to copy the image
        from PIL import Image
        img = Image.open(image_path)
        img.save(public_path)

        # Get stroke data for animation
        stroke_data = get_stroke_data_for_concept(sketch_app)

        # Store information for later modifications
        sketches[concept] = {
            'original_path': image_path,
            'public_path': public_path,
            'args': args,
            'stroke_data': stroke_data
        }

        return jsonify({
            "message": f"Successfully generated sketch of {concept}",
            "image_path": public_path,
            "stroke_data": stroke_data
        })

    except Exception as e:
        print(f"Error generating sketch: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Add a function to generate stroke data from LLM response
def call_model_for_sketch_generation():
    """Get the raw sketching commands from the LLM"""
    return self.call_model_for_sketch_generation()

def get_stroke_data_for_concept(sketch_app):
    """Extract stroke data from LLM output through the SketchApp instance"""
    try:
        # Get the raw LLM output containing stroke instructions
        llm_output = sketch_app.call_model_for_sketch_generation()

        # If we already have XML in the output, extract it
        if "<answer>" in llm_output and "</answer>" in llm_output:
            start_idx = llm_output.find("<answer>")
            end_idx = llm_output.find("</answer>") + len("</answer>")
            xml_content = llm_output[start_idx:end_idx]
            return xml_content

        # If no XML found, we need to parse the LLM output and create XML
        import xml.etree.ElementTree as ET
        from xml.dom import minidom
        import re

        # Create the XML structure
        root = ET.Element("answer")

        concept_elem = ET.SubElement(root, "concept")
        concept_elem.text = sketch_app.target_concept

        strokes_elem = ET.SubElement(root, "strokes")

        # Regular expressions to find stroke data in the LLM output
        stroke_pattern = r's(\d+)\s*=\s*\[(.*?)\]'
        point_pattern = r'\((\d+),\s*(\d+)\)'

        # Find all strokes
        stroke_matches = re.finditer(stroke_pattern, llm_output, re.DOTALL)

        stroke_count = 0
        for stroke_match in stroke_matches:
            stroke_count += 1
            stroke_num = stroke_match.group(1)
            stroke_content = stroke_match.group(2)

            # Create stroke element
            stroke_elem = ET.SubElement(strokes_elem, f"s{stroke_num}")

            # Find all points
            points = []
            point_matches = re.finditer(point_pattern, stroke_content)
            for point_match in point_matches:
                x = point_match.group(1)
                y = point_match.group(2)
                points.append(f"'x{x}y{y}'")

            # Add points to stroke
            points_elem = ET.SubElement(stroke_elem, "points")
            points_elem.text = ", ".join(points)

            # Generate evenly distributed t-values
            t_values = []
            if len(points) > 0:
                for i in range(len(points)):
                    t_values.append(f"{i/(len(points)-1):.2f}" if len(points) > 1 else "0.00")

            # Add t-values to stroke
            t_values_elem = ET.SubElement(stroke_elem, "t_values")
            t_values_elem.text = ", ".join(t_values)

            # Add id to stroke
            id_elem = ET.SubElement(stroke_elem, "id")
            id_elem.text = f"stroke_{stroke_num}"

        # If no strokes found, create a fallback
        if stroke_count == 0:
            # Try another pattern - looking for specific format in the LLM output
            # Format like: "Now, I'll provide the x-y coordinates for each part."
            part_pattern = r'<s(\d+)>(.*?)</s\1>'
            part_matches = re.finditer(part_pattern, llm_output, re.DOTALL)

            for part_match in part_matches:
                stroke_num = part_match.group(1)
                part_content = part_match.group(2)

                # Create stroke element
                stroke_elem = ET.SubElement(strokes_elem, f"s{stroke_num}")

                # Extract points and id
                points_match = re.search(r'<points>(.*?)</points>', part_content, re.DOTALL)
                id_match = re.search(r'<id>(.*?)</id>', part_content, re.DOTALL)
                t_values_match = re.search(r'<t_values>(.*?)</t_values>', part_content, re.DOTALL)

                if points_match:
                    points_elem = ET.SubElement(stroke_elem, "points")
                    points_elem.text = points_match.group(1).strip()
                else:
                    # Default points if none found
                    points_elem = ET.SubElement(stroke_elem, "points")
                    points_elem.text = f"'x10y10', 'x40y10', 'x40y40', 'x10y40', 'x10y10'"

                if t_values_match:
                    t_values_elem = ET.SubElement(stroke_elem, "t_values")
                    t_values_elem.text = t_values_match.group(1).strip()
                else:
                    # Default t-values if none found
                    t_values_elem = ET.SubElement(stroke_elem, "t_values")
                    t_values_elem.text = "0.00, 0.25, 0.50, 0.75, 1.00"

                if id_match:
                    id_elem = ET.SubElement(stroke_elem, "id")
                    id_elem.text = id_match.group(1).strip()
                else:
                    id_elem = ET.SubElement(stroke_elem, "id")
                    id_elem.text = f"stroke_{stroke_num}"

                stroke_count += 1

        # If still no strokes found, add a default stroke
        if stroke_count == 0:
            # Add a default square as fallback
            stroke_elem = ET.SubElement(strokes_elem, "s1")

            points_elem = ET.SubElement(stroke_elem, "points")
            points_elem.text = "'x10y10', 'x40y10', 'x40y40', 'x10y40', 'x10y10'"

            t_values_elem = ET.SubElement(stroke_elem, "t_values")
            t_values_elem.text = "0.00, 0.25, 0.50, 0.75, 1.00"

            id_elem = ET.SubElement(stroke_elem, "id")
            id_elem.text = "default_stroke"

        # Format the XML nicely
        xml_str = minidom.parseString(ET.tostring(root)).toprettyxml(indent="  ")
        return xml_str

    except Exception as e:
        print(f"Error generating stroke data: {e}")
        # Return a simple fallback if all else fails
        return """
<answer>
  <concept>fallback</concept>
  <strokes>
    <s1>
      <points>'x10y10', 'x40y10', 'x40y40', 'x10y40', 'x10y10'</points>
      <t_values>0.00, 0.25, 0.50, 0.75, 1.00</t_values>
      <id>fallback_stroke</id>
    </s1>
  </strokes>
</answer>
        """

@app.route('/modify-sketch', methods=['POST'])
def modify_sketch():
    try:
        data = request.get_json()
        concept = data.get('concept', '')
        modification = data.get('modification', '')

        if not concept or not modification:
            return jsonify({"error": "Both concept and modification must be provided"}), 400

        # Check if we have this sketch
        if concept not in sketches:
            return jsonify({"error": f"No sketch found for '{concept}'"}), 404

        # Create new args for modification
        args = create_args_for_concept(f"{concept} with {modification}")

        # Initialize SketchApp with modified concept
        sketch_app = SketchApp(args)

        # Generate the sketch
        sketch_app.generate_sketch()

        # Get stroke data for animation
        stroke_data = get_stroke_data_for_concept(sketch_app)

        # Get image path
        image_path = f"{args.path2save}/{args.save_name}.png"
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        public_path = f"static/sketches/{args.save_name}_{timestamp}.png"

        # Copy to static folder for serving
        os.makedirs(os.path.dirname(f"static/sketches/"), exist_ok=True)

        # Use PIL to copy the image
        from PIL import Image
        img = Image.open(image_path)
        img.save(public_path)

        # Update stored information
        sketches[concept] = {
            'original_path': image_path,
            'public_path': public_path,
            'args': args,
            'stroke_data': stroke_data
        }

        return jsonify({
            "message": f"Successfully modified sketch of {concept}",
            "image_path": public_path,
            "stroke_data": stroke_data
        })

    except Exception as e:
        print(f"Error modifying sketch: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/static/sketches/<path:filename>')
def serve_sketch(filename):
    return send_from_directory('static/sketches', filename)


if __name__ == '__main__':
    # Create static directory if it doesn't exist
    os.makedirs('static/sketches', exist_ok=True)

    # Run the app
    app.run(debug=True, host='0.0.0.0', port=5001)
