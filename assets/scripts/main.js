// Api Key
const API_KEY = "4e47d2a70679ff11d4bf8df1517e768f";

// Initial city to load if user has not used the app before
const STARTING_CITY = "Miami";

// Wait for document to be prepared before starting logic
$(document).ready(async function () {
  // Inject date to outline box
  $("#current-date").text(dayjs().format("(M/D/YYYY)"));

  // Handle our initial page page load
  // Default to Miami, but if we are not new to the page, load the last searched city
  const searchHistory = localStorage.getItem("searchHistory");
  if (searchHistory) {
    const lastSearchedCity = JSON.parse(searchHistory)[0];
    await getCityWeather(lastSearchedCity);
  } else {
    await getCityWeather(STARTING_CITY);
  }

  // Handle search button click event
  $("#search-button").click(async function (e) {
    const cityName = $("#search-input").val();

    // Validate that city name is not empty
    if (cityName) {
      getCityWeather(cityName);
    }
  });
});

// Our top box has the current days weather data
// Abstracts injecting that data
function setCurrentWeather(weatherData) {
  $("#current-temperature").text(`${weatherData.main.temp}°F`);
  $("#current-windspeed").text(`${weatherData.wind.speed} MPH`);
  $("#current-humidity").text(`${weatherData.main.humidity}%`);

  $("#current-weather-indicator").attr(
    "src",
    getImageUrl(weatherData.weather[0].icon)
  );
}

// Abtracts creating the forecast cards (5 day period)
function createForecastCards(forecastList) {
  // The api gives back results for the last 5 days, but returns 8 results per day
  // Via 3 hour periods. So we push to an array the first result of each day
  const forecast = [];

  // Iterate for the next 5 days
  for (let i = 0; i < 5; i++) {
    // Get the day of the iteration + 1 (we don't want 'today')
    const currentDay = dayjs()
      .add(i + 1, "day")
      .startOf("day")
      .unix();

    // Only return the first result of the current iterated day
    const forecastData = forecastList.find((forecast) => {
      // Added startOf to ensure we are getting a consistent timestamp that is always based on the same time
      const forecastDay = dayjs.unix(forecast.dt).startOf("day").unix();
      if (forecastDay === currentDay) {
        return forecast;
      }
    });

    // Push the result we found
    forecast.push(forecastData);
  }

  // Reset our 5-day forecast container
  // We want to remove our previous forecast cards before adding new ones
  const forecastContainer = $("#forecast-container");
  forecastContainer.children().remove();

  // Iterate through the 5 forecast we found
  forecast.forEach((forecastData, index) => {
    // Append a card that contains our forecast data
    forecastContainer.append(
      $("<div/>", {
        class:
          "flex flex-col bg-slate-700 px-2 pt-1 pb-6 flex-grow gap-y-4 text-white",
      }).append([
        $("<span/>", { class: "font-bold" }).text(
          dayjs().add(index, "day").format("M/D/YYYY")
        ),
        $("<img/>", { class: "w-[36px] h-[36px]" }).attr(
          "src",
          getImageUrl(forecastData.weather[0].icon)
        ),
        $("<span/>").text(`Temp: ${forecastData.main.temp}°F`),
        $("<span/>").text(`Wind: ${forecastData.wind.speed} MPH`),
        $("<span/>").text(`Humidity ${forecastData.main.humidity}%`),
      ])
    );
  });
}

// Abstracts creating our search history buttons
function createSearchHistory() {
  // Validate we have a search history in localstorage
  const searchHistory = localStorage.getItem("searchHistory");
  if (searchHistory) {
    const searchHistoryArray = JSON.parse(searchHistory);

    // Reset our search history buttons so we can append the updated/created values
    const searchContainer = $("#search-history");
    searchContainer.children().remove();

    // Append our new search history buttons based on our updated values
    // Our most recent button will start at the top, so the history is sequential
    searchHistoryArray.forEach((cityName) => {
      searchContainer.append(
        $("<button/>", {
          class:
            "w-full py-[6px] rounded-md bg-gray-300 transition duration-300 ease-in-out text-[18px]",
        }).text(cityName)
      );
    });

    // Handle our events for the new elements
    $("#search-history")
      .children("button")
      .click(async function (e) {
        // When clicking a button we should search for that city
        const cityName = e.target.textContent;
        getCityWeather(cityName);
      });
  }
}

// Abstracts getting the city weather data
// The api request a sequence of request to get the data we need by the name of the city
// We also handle our search history logic and updating our dom to inject these changes
async function getCityWeather(cityName) {
  // Request the city coords using the name and validate that we got back a valid response
  // This request is required to get the weather data later, as we need coords for the weather request
  const cityCoords = await requestCityCoords(cityName);

  // If our city doesn't exist this will be an empty array
  if (cityCoords.length === 0) {
    throw new Error("City not found");
  }

  // Assume our most valid response is the first result
  // Conveniently the api returns the city name it thinks we are looking for
  // So we can inject that as the city name instead of what was possibly typed into the input
  $("#city-name").text(cityCoords[0].name);

  // Handle loading our search history
  const searchHistory = localStorage.getItem("searchHistory");
  if (searchHistory) {
    const searchHistoryArray = JSON.parse(searchHistory);

    // Check if a city already exist
    if (searchHistoryArray.includes(cityCoords[0].name)) {
      // If it does, remove it from the array - so when we add it back it will be at the front
      // Without a duplicate entry
      searchHistoryArray.splice(
        searchHistoryArray.indexOf(cityCoords[0].name),
        1
      );
    }

    // Add the city to the front of the array (index 0)
    searchHistoryArray.splice(0, 0, cityCoords[0].name);

    // After adding our possibly new entry, check if we have gone over the cap of 8
    if (searchHistoryArray.length > 8) {
      // Remove the last entry from the array (Oldest)
      searchHistoryArray.pop();
    }

    // Update our localstorage with our new search history
    localStorage.setItem("searchHistory", JSON.stringify(searchHistoryArray));
  } else {
    // If we don't have a search history, create one with the current city
    localStorage.setItem("searchHistory", JSON.stringify([cityCoords[0].name]));
  }

  // Update/Create our search history buttons
  createSearchHistory();

  // Request the city weather using the coords
  const cityWeather = await requestCityWeather(
    cityCoords[0].lat,
    cityCoords[0].lon
  );

  // Inject our current days weather data
  const currentWeather = cityWeather.list[0];
  setCurrentWeather(currentWeather);

  // Inject our 5 day forecast data as cards
  createForecastCards(cityWeather.list);
}

// Abstract our api request for getting the city weather
// This requires our longitude and latitude - so for our app we will have to do this last
// We also assume we want imperial units, so that is passed to the query parameters
async function requestCityWeather(lat, lon) {
  const BASE_URL = "https://api.openweathermap.org/data/2.5/forecast";
  const requestUrl = `${BASE_URL}?lat=${lat}&lon=${lon}&units=imperial`;
  const response = await buildRequest(requestUrl);
  return response;
}

// Abstract our api request for getting the city coords
// We use our city name here to get the coords then do another request for the weather
// We assume our first result is the most valid so we also limit to 1 result
async function requestCityCoords(cityName) {
  const BASE_URL = "http://api.openweathermap.org/geo/1.0/direct";
  const requestUrl = `${BASE_URL}?q=${cityName}&limit=1`;
  const response = await buildRequest(requestUrl);
  return response;
}

// Abstract our api request fetching process
// Removes some redundancy
async function buildRequest(requestUrl) {
  const builtRequestUrl = `${requestUrl}&appid=${API_KEY}`;
  const response = await fetch(builtRequestUrl);

  // Return json to the rest of our app
  return await response.json();
}

// Abtract our the process of building the url for each place a weather icon is needed
function getImageUrl(icon) {
  return `http://openweathermap.org/img/wn/${icon}.png`;
}
