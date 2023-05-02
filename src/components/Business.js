import React, { useState, useEffect } from "react";
import "../App.css";

function App() {
  // list of businesses
  const [businesses, setBusinesses] = useState([]);
  // user's capital
  const [capital, setCapital] = useState(1000);
  // user's id (get the user id from the local storage, if not found then generate one and store it in local storage)
  const [userId] = useState(() => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      return storedUserId;
    } else {
      const { v4: uuidv4 } = require('uuid');
      const newUserId = uuidv4();
      localStorage.setItem('userId', newUserId);
      return newUserId;
    }
  });
  // flag to prevent the "handleStartManager" effect from rerunning everytime "businesses" is updated
  const [flag, setFlag] = useState(0);

  // get businesses
  useEffect(() => {
    fetch(`http://localhost:3003/api/business/${userId}`)
      .then((response) => response.json())
      .then((data) => {
        const businessesLevelCheck = data.businesses.map((business) => {
          if(business.current_level>0){
            business.rewards = business.current_level * business.base_rewards;
            business.upgrading_price = business.base_upgrading_price + (business.base_upgrading_price * 0.15 * (business.current_level - 1));
          }
          return business;
        });
        setBusinesses(businessesLevelCheck)
        setCapital(data.capital + data.offlineRewards)
      })
      .catch((error) => {
        console.error('Error fetching data: ', error);
      });
  }, []);

  // if business is managed, start the manager
  useEffect(() => {
    if(flag<2){
      businesses.forEach(business => {
        if(business.is_managed){
          handleStartManager(business)
        }
      });
      setFlag(flag+1)
    }
  }, [businesses]);
  

  // save progress
  useEffect(() => {
    const handleBeforeUnload = async () => {
      await fetch("http://localhost:3003/api/saveUserData", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          capital,
          businesses,
        }),
      });
    };
  
    window.addEventListener('beforeunload', handleBeforeUnload);
  
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  // unlocking a business
  const handleUnlock = (business) => {
    if (capital >= business.unlocking_price) {
      setCapital(capital - business.unlocking_price);
      business.current_level = 1;
      business.rewards = business.base_rewards;
      business.upgrading_price = business.base_upgrading_price;
    }
  };

  // collecting business rewards
  const handleCollect = (business) => {
    business.is_cooling_down = true;
    business.cooldown_progress = 0; // Initialize the progress to 0
    const intervalId = setInterval(() => {
      if (business.cooldown_progress >= business.cooldown * 1000) {
        setCapital((capital) => capital + business.rewards);
        business.is_cooling_down = false;
        clearInterval(intervalId); // Stop the interval
        setBusinesses([...businesses]); // Trigger re-render
      } else {
        business.cooldown_progress += 10;
        setBusinesses([...businesses]); // Trigger re-render
      }
    }, 10);
  };
  
  // upgrading a business
  const handleUpgrade = (business) => {
    if (capital >= business.upgrading_price) {
      setCapital(capital - business.upgrading_price);
      business.current_level++;
      business.rewards = business.current_level * business.base_rewards;
      business.upgrading_price = business.base_upgrading_price + (business.base_upgrading_price * 0.15 * (business.current_level - 1));
    }
  };
  
  // hire a manager
  const handleHireManager = (business) => {
    if (capital >= business.manager_cost) {
      setCapital(capital - business.manager_cost);
      
      business.is_managed = true;
      handleCollect(business)
      const intervalId = setInterval(() => {
        handleCollect(business)
      }, (business.cooldown * 1000)+100);
      business.manager_intervalId = intervalId;
      setBusinesses([...businesses]);
    }
  };

  // start manager (when loading businesses with existing managers)
  const handleStartManager = (business) => {
      handleCollect(business)
      const intervalId = setInterval(() => {
        handleCollect(business)
      }, (business.cooldown * 1000)+100);
      business.manager_intervalId = intervalId;
      setBusinesses([...businesses]);
  };
  
  // fire manager just for debug purposes
  /*const handleFireManager = (business) => {
    clearInterval(business.manager_intervalId);
    business.is_managed = false;
    setBusinesses([...businesses]);
  };*/

  return (
    <div className="App">
      <h1>Adventure Capitalist Clone</h1>
      <h2>Capital: {formatNumber(capital)}</h2>
      {businesses.map((business) => (
        <div key={business.name} style={{ position: "relative" }}>
          <h3>{business.name}</h3>
          {business.current_level > 0 ? (
            <>
              <p>Current Level: {business.current_level}</p>
              <p>Rewards: {formatNumber(business.rewards)}</p>
              <p>Upgrading Price: {formatNumber(business.upgrading_price)}</p>
              <button
                disabled={business.is_cooling_down || business.is_managed}
                onClick={() => handleCollect(business)}
              >
                {business.is_cooling_down || business.is_managed
                  ? "Collecting..."
                  : "Collect Rewards"}
              </button>
              <button onClick={() => handleUpgrade(business)}>
                Upgrade Business
              </button>
              {!business.is_managed && (
                <>
                <p>Hiring Price: {formatNumber(business.manager_cost)}</p>
                <button onClick={() => handleHireManager(business)}>
                  Hire Manager
                </button>
              </>
              ) /*: (
                <button onClick={() => handleFireManager(business)}>
                  Fire Manager
                </button>
              )*/}
              <div
                className="cooldown-bar"
                style={{
                  width: `${business.is_cooling_down
                    ? (business.cooldown_progress / (business.cooldown * 1000)) * 100
                    : 0
                  }%`,
                }}
              ></div>
            </>
          ) : (
            <>
              <p>Unlocking Price: {business.unlocking_price.toFixed(2)}</p>
              <button onClick={() => handleUnlock(business)}>Unlock</button>
            </>
          )}
        </div>
      ))}
    </div>
  );
  
  //function to format big numbers
  function formatNumber(num) {
    if (num >= 1000000000000) {
      return (num / 1000000000000).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + ' T';
    } else if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + ' B';
    } else if (num >= 1000000) {
      return (num / 1000000).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + ' M';
    } else {
      return Number(num).toFixed(2).toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    }
  }
}

export default App;
