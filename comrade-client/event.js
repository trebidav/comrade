const evtSource = new EventSource("http://localhost:8000/events/");

evtSource.onmessage = (event) => {
    const newElement = document.createElement("li");
    const eventList = document.getElementById("list");
  
    newElement.textContent = `message: ${event.data}`;
    eventList.appendChild(newElement);
  };

  evtSource.onerror = (err) => {
  console.error("EventSource failed:", err);
};

evtSource.onerror = (err) => {
    console.error("EventSource failed:", err);
};