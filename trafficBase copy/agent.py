# agent.py

import heapq
from mesa import Agent
import random


class Car(Agent):
    def __init__(self, unique_id, model, start_position, destination):
        super().__init__(unique_id, model)
        self.position = start_position
        self.destination = destination
        self.path = []
        self.blocked_steps = 0
        self.max_blocked_steps = 4  # Reducido de 16 a 4

    def heuristic(self, a, b):
        """Función heurística para A* (distancia Manhattan)."""
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def congestion_cost(self, position):
        """Calcula el costo de congestión para una posición dada."""
        # Cuenta el número de coches en las celdas adyacentes, incluyendo la posición actual
        positions = [position] + list(self.model.grid.get_neighborhood(position, moore=False, include_center=False))
        congestion = sum(
            1 for pos in positions if any(isinstance(agent, Car) for agent in self.model.grid.get_cell_list_contents(pos))
        )
        return congestion

    def a_star(self):
        """Algoritmo A* para encontrar el camino más corto al destino considerando la congestión."""
        open_set = []
        heapq.heappush(open_set, (0, self.position))
        came_from = {}
        g_score = {self.position: 0}
        f_score = {self.position: self.heuristic(self.position, self.destination)}
        congestion_weight = 2  # Peso ajustable para el costo de congestión

        while open_set:
            _, current = heapq.heappop(open_set)

            if current == self.destination:
                # Reconstruir el camino
                path = []
                while current in came_from:
                    path.append(current)
                    current = came_from[current]
                path.reverse()
                return path

            for neighbor in self.get_neighbors(current, consider_cars=False):
                # Costo aleatorio reducido para diversificar rutas
                random_cost = random.uniform(0, 0.1)
                congestion = self.congestion_cost(neighbor)
                tentative_g_score = g_score[current] + 1 + random_cost + congestion_weight * congestion

                if tentative_g_score < g_score.get(neighbor, float("inf")):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    f_score[neighbor] = g_score[neighbor] + self.heuristic(neighbor, self.destination)
                    if neighbor not in [i[1] for i in open_set]:
                        heapq.heappush(open_set, (f_score[neighbor], neighbor))

        return []  # No se encontró camino

    def get_neighbors(self, position, consider_cars=True):
        """Obtiene todas las celdas vecinas válidas."""
        direction_map = {
            (position[0] + 1, position[1]): "Right",
            (position[0] - 1, position[1]): "Left",
            (position[0], position[1] + 1): "Up",
            (position[0], position[1] - 1): "Down"
        }
        opposite_directions = {
            "Up": "Down",
            "Down": "Up",
            "Left": "Right",
            "Right": "Left"
        }

        valid_neighbors = [
            pos for pos in direction_map if not self.model.grid.out_of_bounds(pos)
        ]
        filtered_neighbors = []

        for pos in valid_neighbors:
            cell_agents = self.model.grid.get_cell_list_contents(pos)

            # Verificar si el vecino es un destino que no es el destino del agente
            if any(isinstance(agent, Destination) for agent in cell_agents) and pos != self.destination:
                continue  # Saltar este vecino

            road_agents = [agent for agent in cell_agents if isinstance(agent, Road)]

            is_valid_direction = True
            for road_agent in road_agents:
                if road_agent.direction == opposite_directions[direction_map[pos]]:
                    is_valid_direction = False
                    break

            if is_valid_direction and self.can_move(pos, consider_cars):
                filtered_neighbors.append(pos)

        return filtered_neighbors

    def can_move(self, next_position, consider_cars=True):
        """Comprueba si el coche puede moverse a la siguiente posición."""
        cell_agents = self.model.grid.get_cell_list_contents(next_position)

        # Verificar obstáculos
        if any(isinstance(agent, Obstacle) for agent in cell_agents):
            return False

        # Verificar otros coches
        if consider_cars and any(isinstance(agent, Car) for agent in cell_agents):
            return False

        # Verificar semáforos
        for agent in cell_agents:
            if isinstance(agent, Traffic_Light) and not agent.state:
                return False
        return True

    def move(self):
        """Mueve el coche a lo largo del camino calculado."""
        if not self.path:
            self.path = self.a_star()

        if self.path:
            next_position = self.path[0]
            cell_agents = self.model.grid.get_cell_list_contents(next_position)

            # Verificar semáforos
            for agent in cell_agents:
                if isinstance(agent, Traffic_Light) and not agent.state:
                    self.blocked_steps += 1
                    return

            if self.can_move(next_position, consider_cars=True):
                self.path.pop(0)
                self.model.grid.move_agent(self, next_position)
                self.blocked_steps = 0  # Reiniciar contador si se mueve
            else:
                self.blocked_steps += 1
                if self.blocked_steps >= self.max_blocked_steps:
                    # Intentar encontrar una celda alternativa adyacente
                    neighbors = self.get_neighbors(self.pos, consider_cars=True)
                    if neighbors:
                        self.model.grid.move_agent(self, neighbors[0])
                    else:
                        # Replanificar ruta
                        self.path = self.a_star()
                    self.blocked_steps = 0

    def step(self):
        """Comportamiento del coche en cada paso de la simulación."""
        if self.pos == self.destination:
            # Eliminar coche cuando llega al destino
            self.model.grid.remove_agent(self)
            self.model.schedule.remove(self)
            # Eliminar de la lista de coches del modelo
            self.model.cars.remove(self)
        else:
            self.move()




class Traffic_Light(Agent):
    """
    Traffic light. Where the traffic lights are in the grid.
    """
    def __init__(self, unique_id, model, state = False, timeToChange = 10):
        super().__init__(unique_id, model)
        """
        Creates a new Traffic light.
        Args:
            unique_id: The agent's ID
            model: Model reference for the agent
            state: Whether the traffic light is green or red
            timeToChange: After how many step should the traffic light change color 
        """
        self.state = state
        self.timeToChange = timeToChange

    def step(self):
        """ 
        To change the state (green or red) of the traffic light in case you consider the time to change of each traffic light.
        """
        if self.model.schedule.steps % self.timeToChange == 0:
            self.state = not self.state

class Destination(Agent):
    """
    Destination agent. Where each car should go.
    """
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)

    def step(self):
        pass

class Obstacle(Agent):
    """
    Obstacle agent. Just to add obstacles to the grid.
    """
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)

    def step(self):
        pass

class Road(Agent):
    """
    Road agent. Determines where the cars can move, and in which direction.
    """
    def __init__(self, unique_id, model, direction= "Left"):
        """
        Creates a new road.
        Args:
            unique_id: The agent's ID
            model: Model reference for the agent
            direction: Direction where the cars can move
        """
        super().__init__(unique_id, model)
        self.direction = direction

    def step(self):
        pass

