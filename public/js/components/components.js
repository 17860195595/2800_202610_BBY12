/**
 * Added by @Adam
 * 
 * This function loads the navbar component as inner html
 * to the div with the id of navbar in the html files.
 */
function loadNavbar()
{
    const navbar = `
        <div class = "navbar">

            <div class="navbar-left-container">
                <p>Stuff in left container</p>
            </div>

            <div></div>
            <div class="navbar-center-container">
                <img src = "images/logo.png" class = "logo-img">
            </div>

            <div></div>
            <div class="navbar-right-container">
                <p>Stuff in right container</p>
            </div>
            
        </div>
    `;
    //set the inner html of the navbar div(the one with id "navbar") to the navbar component
    document.getElementById("navbar").innerHTML = navbar;
}



/**
 * Call the functions here for them to actually
 * load the components when the page loads.
 */
loadNavbar();