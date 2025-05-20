# 2800-202510-BBY20

# Project Title
CivIQ

# Project Description
CivIQ is a civic engagement platform that connects citizens with city officials through interactive tools such as one-click polls, idea submission boards, and real-time sentiment feedback on local government projects. It enables residents to easily participate in decision-making and helps officials collect actionable insights to guide community planning.

# Technologies Used
Frontend: HTML, JavaScript, HTML Templating (ejs).
Backend: Node.js (with Express framework).
Database: MongoDB.
Other: OpenWeather API was used for user's location

# Listing of File Contents of folder 
.gitignore
README.md
app.js
databaseConnection.js
images/Logo.png
images/default.jpg
package-lock.json
package.json
pollDetail.html
polls.js
profile.js
public/images/Logo.png
public/images/css/dashboard.css
public/images/css/theme.css
public/images/homepage-background.png
public/uploads/1746560296377.png
public/uploads/1746560715655.png
public/uploads/1746560823293.png
public/uploads/1746560939521.jpg
public/uploads/1746560962483.png
public/uploads/1746567892399.jpg
public/uploads/1746568855913.png
public/uploads/1746658070716.png
public/uploads/1747105153574.webp
public/uploads/1747374777145.png
public/uploads/1747380079132.png
public/uploads/1747380551736.png
public/uploads/1747380564325.png
public/uploads/1747380837511.png
public/uploads/1747380847170.png
public/uploads/1747380984061.png
public/uploads/1747381029105.png
public/uploads/1747414727424.webp
views/403.ejs
views/404.ejs
views/about.ejs
views/admin.ejs
views/citizenDashboard.ejs
views/createPoll.ejs
views/dashboard.ejs
views/databaseConnection.js
views/error.ejs
views/index.ejs
views/login.ejs
views/manageTags.ejs
views/pastPolls.ejs
views/pollDetail.ejs
views/pollStats.ejs
views/polls.ejs
views/profile.ejs
views/signup.ejs
views/templates/footer.ejs
views/templates/header.ejs
views/templates/poll.ejs

# How to install or run the project

To get started with running this GitHub project locally on your machine, 
follow the detailed instructions below of what to install, and what technologies are 
essential.

1. Software that must be installed

 a. Languages or runtimes:
 Node.js (v18 or later)
 npm (comes with Node.js)

  b. IDE's:
 Visual Studio Code (VS Code) is recommended, but any code editor will work.

 c. Database(s): 
 A MongoDB Atlas cloud database. You’ll need a free cluster set up for:
 users database, 
 sessions database, 
 polls database.

 d. Other Software:
 Some sort of command line tool to interact with Git. 
 This can be command line, terminal or git bash.
 Sourcetree can also be used for a more visual option.

 2. 3rd Party API's
 OpenWeather API is needed to run this project.

 3. API keys?
 Yes, APi keys are needed to run this project.
 Required API keys:
 MongoDB Atlas credentials for connecting to the database.
 OpenWeather API Key – Get it from https://openweathermap.org/api

4. Order of installation / location
Generally, the order of installation / location does not matter when installing all the software required for 
this project. However, make sure you always remember where everything is installed on your computer, if something
goes wrong. Therefore, whenever choosing an install location, the default location on your computer is recommended
so you have easy access to everything.

5. Detailed configuration instructions
Below is a list of detailed instructions on how to get the project up and running:

Create .env file in the root of the project.
Copy and paste the following into .env, then fill in your values:

MONGODB_USER=your_mongodb_user
MONGODB_PASSWORD=your_mongodb_password
MONGODB_HOST=your_cluster.mongodb.net
MONGODB_DATABASE_USERS=users
MONGODB_DATABASE_SESSIONS=sessions
MONGODB_DATABASE_POLLS=polls
MONGODB_SESSION_SECRET=your_session_secret
NODE_SESSION_SECRET=your_node_secret
PORT=8080
OPENWEATHER_API_KEY=your_openweather_api_key

Set up your MongoDB Atlas cluster:
Create user with matching credentials
Enable access for your IP
Create the users, sessions, and polls databases manually

Install dependencies:
Using npm install

Run the server to start the app:

Using this command on any Command Line Tool -> Node app.js
This will start the server and you can Visit http://localhost:8080 in your browser to view the app.


6. Link to Testing Plan:
https://docs.google.com/spreadsheets/d/1TInocgFaGGg3ralL2IxeDMfRh3M9i10RcjcwIO0CjXw/edit?gid=0#gid=0


7. Passwords.txt 
File will be submitted alongside 

# How to use the product (features)

The core idea of this app is that City officials can post polls for local city projects 
and local citizens can vote on them, and leave comments, leaving their valuable opinions
so City Officials can collect their data.

By making a citizen account in the app you have access to vote on any poll in the home page. Citizens can filter polls
by the tag(s) a poll is given for easy navigation. Furthermore, a citizen can vote on a poll and even leave a comment
on what they think on the topic by clicking on the poll in the main page. Also, the app has personalization features for
citizens to feel more engaged with the experience including profile pages where citizens can upload their own profile photo. 
As well, the app offers citizens to be able to save polls to their profile page, for easy access to the polls they want to 
vote on later, or keep track of. 

On the other hand City Officials have a slightly different experience. When you create a City Official account, you are able to post
polls for the citizens to vote on. Tags can be added to these polls so that they are better filtered and stand out. Also, City Officials have their own dashboard to view stats like which option citizens voted the most on their poll, and how many citizens saved their poll. 







