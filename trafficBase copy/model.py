# model.py

from mesa import Model
from mesa.time import RandomActivation
from mesa.space import MultiGrid
from agent import *
import json
import random
from mesa.datacollection import DataCollector

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
        self.congestion_map = {}  # Diccionario para rastrear la congestión

        # DataCollector for tracking metrics
        self.datacollector = DataCollector(
            {
                "Cars in Simulation": lambda m: len(m.cars),
                "Cars Created": lambda m: m.car_count,
                "Cars Arrived": lambda m: m.car_count - len(m.cars),
            }
        )

        # Load the map dictionary
        dataDictionary = json.load(open("city_files/mapDictionary.json"))

        # Load the map file
        with open('city_files/2024_base.txt') as baseFile:
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
                        self.schedule.add(agent)

                    elif col in ["S", "s"]:
                        agent = Traffic_Light(f"tl_{r*self.width+c}", self, False if col == "S" else True, int(dataDictionary[col]))
                        self.grid.place_agent(agent, (c, self.height - r - 1))
                        self.schedule.add(agent)
                        self.traffic_lights.append(agent)

                    elif col == "#":
                        agent = Obstacle(f"ob_{r*self.width+c}", self)
                        self.grid.place_agent(agent, (c, self.height - r - 1))
                        self.schedule.add(agent)

                    elif col == "D":
                        agent = Destination(f"d_{r*self.width+c}", self)
                        self.grid.place_agent(agent, (c, self.height - r - 1))
                        self.schedule.add(agent)

        self.num_agents = N
        self.running = True

        # Posiciones iniciales con los destions
        self.start_positions = [(0, 0), (0, self.height - 1), (self.width - 1, 0), (self.width - 1, self.height - 1)]

        self.destinations = []
        for x in range(self.width):
            for y in range(self.height):
                cell_agents = self.grid.get_cell_list_contents((x, y))
                for agent in cell_agents:
                    if isinstance(agent, Destination):
                        self.destinations.append((x, y))


    def nivel_congestion(self, position):
        """Calcula el nivel de congestión en una posición dada."""
        cell_agents = self.grid.get_cell_list_contents(position)
        # Nivel de congestión basado en el número de coches en la posición y sus vecinas inmediatas
        neighboring_positions = self.grid.get_neighborhood(position, moore=False, include_center=True)
        congestion = 0
        for pos in neighboring_positions:
            congestion += sum(1 for agent in self.grid.get_cell_list_contents(pos) if isinstance(agent, Car))
        return congestion

    def add_cars(self):
        """Agregar nuevos coches al entorno desde posiciones de inicio priorizando las menos congestionadas."""
        if self.destinations:
            # Calcular el nivel de congestión para cada posición de inicio
            congestion_levels = {pos: self.nivel_congestion(pos) for pos in self.start_positions}
            
            # Ordenar las posiciones de inicio de menor a mayor congestión
            start_positions_sorted = sorted(self.start_positions, key=lambda pos: congestion_levels[pos])
            
            added_car = False
            for start_position in start_positions_sorted:
                destination = random.choice(self.destinations)
                cell_agents = self.grid.get_cell_list_contents(start_position)
                if any(isinstance(agent, Car) for agent in cell_agents):
                    continue  # Saltar si ya hay un coche en la posición de inicio
                
                # Agregar el coche
                car = Car(f"car_{self.car_count}", self, start_position, destination)
                self.grid.place_agent(car, start_position)
                self.schedule.add(car)
                self.cars.append(car)
                self.car_count += 1
                added_car = True

            # Si no se pudo agregar ningún coche en esta iteración, detener la simulación
            if not added_car:
                print("No hay más espacio en las esquinas para agregar coches. Terminando la simulación.")
                self.running = False

    def step(self):
        """Advance the model by one step."""
        self.schedule.step()
        self.step_count += 1

        # Añadir los coches cada 2 pasos.
        if self.step_count % 2 == 0 or self.step_count == 1:
            self.add_cars()
        
        # Recopilar datos
        self.datacollector.collect(self)
