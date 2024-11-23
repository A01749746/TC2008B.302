import heapq
from mesa import Agent

class Car(Agent):
    def __init__(self, unique_id, model, start_position, destination):
        super().__init__(unique_id, model)
        self.position = start_position
        self.destination = destination
        self.path = []

    def heuristic(self, a, b):
        """Heuristic function for A* (Manhattan distance)."""
        return abs(a[0] - b[0]) + abs(a[1] - b[1])

    def a_star(self):
        """A* algorithm to find the shortest path to the destination."""
        open_set = []
        heapq.heappush(open_set, (0, self.position))
        came_from = {}
        g_score = {self.position: 0}
        f_score = {self.position: self.heuristic(self.position, self.destination)}

        while open_set:
            _, current = heapq.heappop(open_set)

            if current == self.destination:
                path = []
                while current in came_from:
                    path.append(current)
                    current = came_from[current]
                path.reverse()
                return path

            for neighbor in self.get_neighbors(current):
                tentativo_g_score = g_score[current] + 1

                if tentativo_g_score < g_score.get(neighbor, float("inf")):
                    came_from[neighbor] = current
                    g_score[neighbor] = tentativo_g_score
                    f_score[neighbor] = g_score[neighbor] + self.heuristic(neighbor, self.destination)
                    if neighbor not in [i[1] for i in open_set]:
                        heapq.heappush(open_set, (f_score[neighbor], neighbor))

        return []  # No path found

    def get_neighbors(self, position):
        """Get all neighboring cells."""
        neighbors = [
            (position[0] + 1, position[1]),
            (position[0] - 1, position[1]),
            (position[0], position[1] + 1),
            (position[0], position[1] - 1)
        ]
        valid_neighbors = [
            pos for pos in neighbors if not self.model.grid.out_of_bounds(pos)
        ]
        return [pos for pos in valid_neighbors if self.can_move(pos)]

    def can_move(self, next_position):
        """Check if the car can move to the next position."""
        cell_agents = self.model.grid.get_cell_list_contents(next_position)

        # Checar los obstavculos y otros coches
        if any(isinstance(agent, Obstacle) or isinstance(agent, Car) for agent in cell_agents):
            return False

        # Checar los semáforos
        for agent in cell_agents:
            if isinstance(agent, Traffic_Light) and not agent.state:
                return False
        return True

    def move(self):
        """Move the car along the calculated path."""
        if not self.path:
            self.path = self.a_star()

        if self.path:
            next_position = self.path[0] 
            cell_agents = self.model.grid.get_cell_list_contents(next_position)

            # Checar si hay semáforo en frente y si está en rojo
            for agent in cell_agents:
                if isinstance(agent, Traffic_Light) and not agent.state:
                    return

            # Si se puede si se mueve
            if self.can_move(next_position):
                self.path.pop(0)  
                self.model.grid.move_agent(self, next_position)


    def step(self):
        """Car's behavior for each simulation step."""
        if self.pos == self.destination:
            # Borrar coche cuando llega al destino
            self.model.grid.remove_agent(self)
            self.model.schedule.remove(self)
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