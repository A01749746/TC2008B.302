from flask import Flask, jsonify, request
from flask_cors import CORS, cross_origin
from randomAgents.model import CityModel
from randomAgents.agent import Car, Traffic_Light, Obstacle, Road, Destination

app = Flask("Traffic Simulation")
CORS(app)

# Global variables
trafficModel = None
currentStep = 0

@app.route('/init', methods=['POST'])
@cross_origin()
def initModel():
    """Initialize the simulation."""
    global trafficModel, currentStep

    try:
        params = request.json
        num_cars = params.get("N", 5)
        trafficModel = CityModel(num_cars)
        currentStep = 0
        return jsonify({"message": "CityModel initialized successfully."})
    except Exception as e:
        print(f"Error initializing model: {e}")
        return jsonify({"message": "Error initializing model."}), 500


@app.route('/getCars', methods=['GET'])
@cross_origin()
def getCars():
    """Fetch positions of all cars."""
    try:
        if not trafficModel:
            return jsonify({"message": "Model not initializated"}), 400
        cars = [
            {"id": car.unique_id, "x": car.pos[0], "y": 1, "z": trafficModel.height - car.pos[1]}
            for car in trafficModel.cars
            if car.pos is not None
        ]
        return jsonify({"positions": cars})
    except Exception as e:
        print(f"Error fetching cars: {e}")
        return jsonify({"message": "Error fetching cars."}), 500


@app.route('/getObstacles', methods=['GET'])
@cross_origin()
def getObstacles():
    try:
        obstacles = [
            {"id": obstacle.unique_id, "x": obstacle.pos[0], "y": 1, "z": trafficModel.height - obstacle.pos[1]}
            for obstacle in trafficModel.schedule.agents
            if isinstance(obstacle, Obstacle)
        ]
        return jsonify({"positions": obstacles})
    except Exception as e:
        print(f"Error fetching obstacles: {e}")
        return jsonify({"message": "Error fetching obstacles."}), 500


@app.route('/getDestinations', methods=['GET'])
@cross_origin()
def getDestinations():
    try:
        destinations = [
            {"id": dest.unique_id, "x": dest.pos[0], "y": 1, "z": trafficModel.height - dest.pos[1]}
            for dest in trafficModel.schedule.agents
            if isinstance(dest, Destination)
        ]
        return jsonify({"positions": destinations})
    except Exception as e:
        print(f"Error fetching destinations: {e}")
        return jsonify({"message": "Error fetching destinations."}), 500


@app.route('/getTrafficLights', methods=['GET'])
@cross_origin()
def getTrafficLights():
    """Fetch positions and states of all traffic lights."""
    try:
        traffic_lights = [
            {
                "id": light.unique_id,
                "x": light.pos[0],
                "y": 3,
                "z": trafficModel.height - light.pos[1],
                "state": light.state,
            }
            for light in trafficModel.traffic_lights
        ]
        return jsonify({"positions": traffic_lights})
    except Exception as e:
        print(f"Error fetching traffic lights: {e}")
        return jsonify({"message": "Error fetching traffic lights."}), 500


@app.route('/getRoads', methods=['GET'])
@cross_origin()
def getRoads():
    """Fetch positions of all roads."""
    try:
        roads = [
            {"id": road.unique_id, "x": road.pos[0], "y": 1, "z": trafficModel.height - road.pos[1], "direction": road.direction}
            for road in trafficModel.schedule.agents
            if isinstance(road, Road)
        ]
        return jsonify({"positions": roads})
    except Exception as e:
        print(f"Error fetching roads: {e}")
        return jsonify({"message": "Error fetching roads."}), 500



@app.route('/update', methods=['GET'])
@cross_origin()
def updateModel():
    """Advance the simulation by one step."""
    global currentStep
    try:
        trafficModel.step()
        currentStep += 1
        return jsonify({"message": f"Model updated to step {currentStep}"})
    except Exception as e:
        print(f"Error updating model: {e}")
        return jsonify({"message": "Error updating model."}), 500


if __name__ == '__main__':
    app.run(host="localhost", port=8585, debug=True)
