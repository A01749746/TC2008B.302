from agent import *
from model import CityModel
from mesa.visualization import CanvasGrid, ModularServer
from mesa.visualization.modules import ChartModule
from mesa.visualization.modules import TextElement


class MetricsElement(TextElement):
    """
    Display metrics for the simulation.
    """
    def render(self, model):
        return f"Cars in Simulation: {len(model.cars)}<br>" \
               f"Cars Created: {model.car_count}<br>" \
               f"Cars Arrived: {model.car_count - len(model.cars)}"


def agent_portrayal(agent):
    if agent is None:
        return
    
    portrayal = {"Shape": "rect",
                 "Filled": "true",
                 "Layer": 1,
                 "w": 1,
                 "h": 1
                 }

    if isinstance(agent, Road):
        portrayal["Color"] = "white"
        portrayal["Layer"] = 0
    
    if isinstance(agent, Destination):
        portrayal["Color"] = "lightgreen"
        portrayal["Layer"] = 0

    if isinstance(agent, Traffic_Light):
        portrayal["Color"] = "red" if not agent.state else "green"
        portrayal["Layer"] = 0
        portrayal["w"] = 0.8
        portrayal["h"] = 0.8

    if isinstance(agent, Obstacle):
        portrayal["Color"] = "cadetblue"
        portrayal["Layer"] = 0
        portrayal["w"] = 0.8
        portrayal["h"] = 0.8

    if isinstance(agent, Car):
        portrayal["Color"] = "blue"
        portrayal["Layer"] = 1
        portrayal["w"] = 0.5
        portrayal["h"] = 0.5

    return portrayal


width = 0
height = 0

with open('city_files/2024_base.txt') as baseFile:
    lines = baseFile.readlines()
    width = len(lines[0])-1
    height = len(lines)

# Add the metrics element
metrics_element = MetricsElement()

# Define the grid visualization
grid = CanvasGrid(agent_portrayal, width, height, 500, 500)

# Define the chart module
chart = ChartModule(
    [{"Label": "Cars in Simulation", "Color": "Blue"},
     {"Label": "Cars Created", "Color": "Green"},
     {"Label": "Cars Arrived", "Color": "Red"}],
    data_collector_name="datacollector"
)

model_params = {"N": 5}

server = ModularServer(
    CityModel,
    [grid, metrics_element, chart],
    "Traffic Base",
    model_params
)

server.port = 8521
server.launch()
