/**
 * This just gets the inputs in the signup fields when submit button
 * is clicked and then sends them to the server via the req object.
 * 
 * @author Adam.S 
 * @credit Looked at project from 1800 for reiview on how to do this
 */
document.getElementById('signupButtonID')
    .addEventListener('click', async () => 
    {
        
        const username = document.getElementById('signupUsernameID').value;

        const password = document.getElementById('signupPasswordID').value;

        //sends a req to server at /signup, server recives req
        const res = await fetch('/signup', 
        {
            //req.method
            method: 'POST',

            //req.headers
            headers: 
            {   
                //specifies json data being sent
                'Content-Type': 'application/json'
            },

            //req.body
            body: JSON.stringify(
            {
                username,
                password
            })
        });

        //reads servers request when its done and turn it into js object (client revcieves response res)
        const data = await res.json();

        //puts alert in page
        alert(data.message);
    });
