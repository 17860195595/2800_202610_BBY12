/**
 * Analytics page entry (analytics.html).
 * Page-specific logic will go here.
 */
const analyticsContainer = document.getElementById("analysticsContainer");

/**
 * This function fetches the requiered data from the api and 
 * then sends inner html with embeded api data into the 
 * container with the analytics stuff.
 * 
 * I am not sure if its right cause the version i am working
 * on does not have the API stuff setup.
 * 
 * @author Adam.S
 */
async function loadAnalytics() 
{
    try 
    {
        const respone = await fetch("/api/risk?lat=49.2497&lng=-123.1193&past_days=7")
        const data = await respone.json();

        //to clear old ones
        analyticsContainer.innerHTML = "";

        //loops through each day object
        data[2][0].forEach((day) => 
        {
            const card = document.createElement("div");

            card.classList.add("analytics-example-item")

            card.innerHTML = `
                <h3>
                    ${day.time}
                </h3>

                <p>
                    UV Index: ${day.uv}
                </p>

                <p>
                    Temperature: ${day.temperature}
                </p>

                <p>
                    Risk Score: ${day.risk}
                </p>
            `;

            analyticsContainer.appendChild(card);
        });
    }
    //if something goes wrong
    catch(error)
    {
        console.error("Error Loading Analytics". error);

        analysticsContainer.innerHTML = "ERROR";
    }
}

loadAnalytics();