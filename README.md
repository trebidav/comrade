# Comrade: OpenSource task manager for any community. Gamified.

### Main idea

Comrade App is a community-driven task management platform designed to empower users by facilitating the organization and execution of location-based tasks. By leveraging real-time updates and skill-based task assignments, the app enhances collaboration among community members and streamlines task management.

It is aimed at community workers, volunteers, and organizations that require efficient task management and coordination. This includes non-profit organizations, local community groups, event organizers, and individuals looking to contribute to community service.

Users can easily view available tasks on an interactive map, making it simple to find work that is relevant to their skills and location.
By allowing users to gain specific skills, the app ensures that tasks are assigned to qualified individuals, improving the quality of work and efficiency.
The app provides real-time updates on tasks availability and user locations as well as community chat and notifications, enabling better coordination and communication among team members.
The platform fosters community involvement by allowing users to participate in local initiatives, volunteer opportunities, and collaborative projects.
Gamification elements promotes healthy competition, introduces rewards and achievments to level up the User experience through game-like controls and mechanisms.

### Possible ways to use:

- **Disaster Response Coordination:** In the event of a natural disaster, community organizations can use the app to assign tasks such as delivering supplies, providing medical assistance, or coordinating evacuations based on the skills of volunteers.
- **Local Business Support:** Small businesses can post tasks for community members to assist with, such as promoting their services, helping with deliveries, or organizing events, thereby fostering local economic growth.
- **Environmental Initiatives:** Users can participate in environmental cleanup efforts, tree planting, or conservation projects, with tasks assigned based on skills like landscaping or environmental science.
- **Event Planning and Management:** Organizers can create tasks for community events (e.g., festivals, fairs) and assign roles to volunteers based on their skills, ensuring that all aspects of the event are covered efficiently.
- **P2P Work:** Users with specific skills can offer to solve other people's problems and the app can facilitate task assignments and possibly reward.

# MVP – Looking for contributors!

First milestone is to reach MVP stage by implementing the minimal required functionality so the application can be demonstrated in a very simplified way.

## Basic functionality

- **User Authentication:** Secure login using Google OAuth, providing users with an API token for subsequent requests.
- **Skill Management:** Users can have multiple skills, which determine their eligibility to pick up tasks.
- **Real-Time Location Tracking:** Users can send their GPS location through WebSockets, allowing the app to reflect their current position on a map.
- **Task Management:** Users can create, view, and manage tasks with specific skill requirements.
- **Interactive Map View:** Tasks are displayed on a map, making it easy for users to find and navigate to nearby tasks.


## MVP issues

Issues that should be addressed in the MVP are tracked in the milestone:

https://github.com/trebidav/comrade/milestone/1

## Contributing

**Currently looking for contributors!** 
- Django & Django-rest framework developers
- JavaScript & React developers
- Software Architects and Game Designers

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.


Feel free to comment on the Issues or contribute with ideas if you don't know where to start.

# Install

Use `pipenv` for dependency management 
```
brew install pipenv
```

Run `pre-commit` hooks before opening MR
```
brew install pre-commit
```

Run server
```
pipenv shell
pipenv sync
cd comrade
python manage.py runserver
```

# License

Comrade © 2024 by David Trebicky is licensed under [CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/)
