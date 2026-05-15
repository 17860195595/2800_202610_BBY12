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

        //get rid of [0], [1] as they are coordinates. Flat makes list of list into one big list.
        const allDays = data.slice(2).flat();

        //Time Stamp = the 1/8th time in a day if there is 6 days then there is 6x8 entries
        allDays.forEach((entry) => 
        {
            const card = document.createElement("div");
            card.classList.add("analytics-example-item");

            //format date so its human redable
            const formattedTime = new Date(entry.time).toLocaleString('en-US', 
                    {
                        month: 'short',
                        day: 'numeric',
                        hour : 'numeric',
                        minute: '2-digit'
                    });
            
                    //toFixed for only 2 decimal points
            card.innerHTML = `
                <h3>${formattedTime}</h3>
                <p> 
                    UV Index: ${Number(entry.uv_index).toFixed(2)}
                </p>
                <p>
                    Temperature: ${Number(entry.temperature_C).toFixed(2)}°C
                </p>
                <p>
                    Risk Score: ${Number(entry.risk).toFixed(2)}
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