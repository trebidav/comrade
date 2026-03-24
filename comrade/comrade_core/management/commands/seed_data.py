from django.core.management.base import BaseCommand
from comrade_core.models import Skill, Task, User

# Prague location (user's position)
BASE_LAT = 50.001505372726264
BASE_LON = 14.4158031001824

SKILLS = [
    "Cleaning",
    "Cooking",
    "Medical",
    "Driving",
    "Tech Support",
    "Gardening",
    "Construction",
]

# (name, description, lat_offset, lon_offset, criticality, base_value, minutes, execute_skills, write_skills, read_skills)
TASKS = [
    (
        "Park Cleanup",
        "Pick up litter and clean the benches around the park entrance.",
        0.0010, 0.0005,
        Task.Criticality.LOW, 10.0, 30,
        ["Cleaning"], ["Cleaning"], [],
    ),
    (
        "Food Distribution Point",
        "Help distribute food packages to residents at the community centre.",
        -0.0008, 0.0012,
        Task.Criticality.MEDIUM, 25.0, 60,
        ["Cooking"], ["Cooking"], [],
    ),
    (
        "First Aid Station",
        "Staff the emergency first aid station near the main square.",
        0.0005, -0.0015,
        Task.Criticality.HIGH, 50.0, 120,
        ["Medical"], ["Medical"], [],
    ),
    (
        "Supply Delivery Run",
        "Drive supplies from the warehouse to three drop-off points in the district.",
        -0.0015, -0.0010,
        Task.Criticality.MEDIUM, 30.0, 45,
        ["Driving"], ["Driving"], [],
    ),
    (
        "IT Help Desk",
        "Assist community members with device setup and internet connectivity issues.",
        0.0020, 0.0020,
        Task.Criticality.LOW, 15.0, 30,
        ["Tech Support"], ["Tech Support"], [],
    ),
    (
        "Community Garden Maintenance",
        "Water plants, pull weeds, and harvest vegetables ready for picking.",
        -0.0005, 0.0025,
        Task.Criticality.LOW, 12.0, 40,
        ["Gardening"], ["Gardening"], [],
    ),
    (
        "Pothole Repair",
        "Fill and compact two potholes on Náměstí street before rain arrives.",
        0.0018, -0.0008,
        Task.Criticality.HIGH, 60.0, 90,
        ["Construction"], ["Construction"], [],
    ),
    (
        "Noise Barrier Installation",
        "Assemble and install temporary noise barriers along the event perimeter.",
        -0.0022, 0.0018,
        Task.Criticality.MEDIUM, 35.0, 75,
        ["Construction"], ["Construction"], [],
    ),
    (
        "Water Distribution",
        "Hand out bottled water to volunteers and bystanders at the event.",
        0.0003, -0.0022,
        Task.Criticality.LOW, 8.0, 20,
        [], [], [],
    ),
    (
        "Incident Reporting",
        "Walk the area and document any hazards or incidents using the community app.",
        -0.0012, -0.0020,
        Task.Criticality.MEDIUM, 18.0, 25,
        [], [], [],
    ),
    (
        "Emergency Shelter Setup",
        "Set up temporary shelter tents and cots for displaced residents.",
        0.0025, 0.0003,
        Task.Criticality.HIGH, 70.0, 150,
        ["Construction", "Medical"], ["Construction"], [],
    ),
    (
        "Meal Prep for Volunteers",
        "Prepare hot meals for 30+ volunteers at the coordination hub.",
        -0.0018, 0.0008,
        Task.Criticality.MEDIUM, 20.0, 60,
        ["Cooking"], ["Cooking"], [],
    ),
]


class Command(BaseCommand):
    help = "Seed database with skills and tasks around the test location in Prague"

    def add_arguments(self, parser):
        parser.add_argument(
            "--owner",
            type=str,
            default="david",
            help="Username to set as task owner (default: david)",
        )

    def handle(self, *args, **options):
        owner_username = options["owner"]

        # Resolve owner
        try:
            owner = User.objects.get(username=owner_username)
            self.stdout.write(f"Owner: {owner.username}")
        except User.DoesNotExist:
            self.stdout.write(self.style.WARNING(
                f"User '{owner_username}' not found – tasks will have no owner."
            ))
            owner = None

        # Create skills
        skill_map = {}
        for skill_name in SKILLS:
            skill, created = Skill.objects.get_or_create(name=skill_name)
            skill_map[skill_name] = skill
            label = "created" if created else "exists"
            self.stdout.write(f"  Skill '{skill_name}' – {label}")

        # Assign all skills to owner so they can interact with any task
        if owner:
            for skill in skill_map.values():
                owner.skills.add(skill)
            owner.save()
            self.stdout.write(self.style.SUCCESS(
                f"Assigned all skills to '{owner.username}'"
            ))

        # Create tasks
        created_count = 0
        for (name, desc, dlat, dlon, criticality, base_value, minutes,
             execute_skills, write_skills, read_skills) in TASKS:

            if Task.objects.filter(name=name).exists():
                self.stdout.write(f"  Task '{name}' – already exists, skipping")
                continue

            task = Task(
                name=name,
                description=desc,
                lat=BASE_LAT + dlat,
                lon=BASE_LON + dlon,
                state=Task.State.OPEN,
                owner=owner,
                criticality=criticality,
                base_value=base_value,
                minutes=minutes,
            )
            task.save()

            for sname in execute_skills:
                task.skill_execute.add(skill_map[sname])
            for sname in write_skills:
                task.skill_write.add(skill_map[sname])
            for sname in read_skills:
                task.skill_read.add(skill_map[sname])

            task.save()
            created_count += 1
            self.stdout.write(f"  Task '{name}' – created")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {len(skill_map)} skills, {created_count} new tasks seeded."
        ))
