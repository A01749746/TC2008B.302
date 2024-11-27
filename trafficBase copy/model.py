from mesa import Model
from mesa.time import RandomActivation
from mesa.space import MultiGrid
from agent import *
import json
import random

class CityModel(Model):
    """ 
    Creates a model based on a city map.
    """
    def __init__(self, N):
        self.traffic_lights = []
        self.cars = []
        self.car_count = 0
        self.step_count = 0
        self.path_cache = {}

        # Load the map dictionary
        dataDictionary = json.load(open("city_files/mapDictionary.json"))

        # Load the map file
        with open('city_files/2022_base.txt') as baseFile:
            lines = baseFile.readlines()
            self.width = len(lines[0]) - 1
            self.height = len(lines)

            self.grid = MultiGrid(self.width, self.height, torus=False)
            self.schedule = RandomActivation(self)

            # Load agents from the map file
            for r, row in enumerate(lines):
                for c, col in enumerate(row):
                    if col in ["v", "^", ">", "<"]:
                        agent = Road(f"r_{r*self.width+c}", self, dataDictionary[col])
                        self.grid.place_agent(agent, (c, self.height - r - 1))

                    elif col in ["S", "s"]:
                        agent = Traffic_Light(f"tl_{r*self.width+c}", self, False if col == "S" else True, int(dataDictionary[col]))
                        self.grid.place_agent(agent, (c, self.height - r - 1))
                        self.schedule.add(agent)
                        self.traffic_lights.append(agent)

                    elif col == "#":
                        agent = Obstacle(f"ob_{r*self.width+c}", self)
                        self.grid.place_agent(agent, (c, self.height - r - 1))

                    elif col == "D":
                        agent = Destination(f"d_{r*self.width+c}", self)
                        self.grid.place_agent(agent, (c, self.height - r - 1))

        self.num_agents = N
        self.running = True

        # Posiciones iniciales con los destions
        self.start_positions = [(0, 0), (0, self.height - 1), (self.width - 1, 0), (self.width - 1, self.height - 1)]

        #self.start_positions = [(0, 0)]
        self.destinations = []
        for x in range(self.width):
            for y in range(self.height):
                cell_agents = self.grid.get_cell_list_contents((x, y))
                for agent in cell_agents:
                    if isinstance(agent, Destination):
                        self.destinations.append((x, y))


    def add_cars(self):
        """Add new cars to the environment from starting positions."""
        if self.destinations:
            for start_position in self.start_positions:
                destination = random.choice(self.destinations)
                car = Car(f"car_{self.car_count}", self, start_position, destination)
                self.grid.place_agent(car, start_position)
                self.schedule.add(car)
                self.cars.append(car)
                self.car_count += 1

    def step(self):
        """Advance the model by one step."""
        self.schedule.step()
        self.step_count += 1

        # Añadir los coches cada 10 pasos.
        if self.step_count % 10 == 0 or self.step_count == 1:
            self.add_cars()

