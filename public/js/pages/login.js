/**
 * This just gets the inputs in the login fields when submit button
 * is clicked and then sends them to the server via the req object.
 * 
 * @author Adam.S 
 * @credit Looked at project from 1800 for reiview on how to do this
 */
//adds event listner to submit button for click event
document.getElementById('loginButtonID')
    .addEventListener('click', async () => 
    {
        //input fields
        const username = document.getElementById('loginUsernameID').value;
        const password = document.getElementById('loginPasswordID').value;

        //basically sets req object
        const res = await fetch('/login', 
        {
            method: 'POST',

            headers:
            {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(
            {
                username,
                password
            })
        });

        //waits for servers reponse and alerts it on screen
        const data = await res.json();
        alert(data.message);

        if(res.ok)
        {
            window.location.href="/index.html";
        }
        else
        {
            alert(data.message);
        }
    });