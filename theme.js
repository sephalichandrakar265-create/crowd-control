
  const toggleTheme = () => {
    document.body.classList.toggle("light");
    localStorage.setItem(
      "theme",
      document.body.classList.contains("light") ? "light" : "dark"
    );
  };

  // Load saved theme
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light");
  }
