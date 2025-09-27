// Fixed script.js with corrected heritage point calculation
// All power credit mechanics preserved

let character = {
    heritage: '',
    concept: '',
    position: '',
    trouble: '',
    goal: '',
    secret: '',
    skills: {
        strength: 0,
        warfare: 0,
        psyche: 0,
        endurance: 0,
        status: 0,
        intrigue: 0,
        hunting: 0,
        lore: 0
    },
    powers: [],
    extras: [],
    totalPoints: 60, // Always 60 - never changes
    usedPoints: 0
};

// Heritage management - FIXED to treat heritage as a purchase, not budget modifier
function updateHeritage() {
    const heritage = document.getElementById('heritage').value;
    const heritageInfo = document.getElementById('heritageInfo');
    
    character.heritage = heritage;
    
    let heritageDescription = '';
    
    // Reset heritage-specific power states
    document.getElementById('pattern-adept').disabled = false;
    document.getElementById('shapeshifting').disabled = false;
    
    switch(heritage) {
        case 'recognized-amber':
            heritageDescription = 'Free Pattern Adept power. Gains Court position, Blood Curse, and Slow Regeneration.';
            // Auto-enable Pattern Adept
            document.getElementById('pattern-adept').checked = true;
            document.getElementById('pattern-adept').disabled = true;
            break;
        case 'unrecognized-amber':
            heritageDescription = 'Credit 5 points. Has Blood Curse and Slow Regeneration. Work with GM for details.';
            break;
        case 'chaos':
            heritageDescription = 'Credit 2 points. Free Shapeshifting power.';
            // Auto-enable Shapeshifting
            document.getElementById('shapeshifting').checked = true;
            document.getElementById('shapeshifting').disabled = true;
            break;
        case 'both':
            heritageDescription = 'Costs 3 points. Recognized status, Court position, Blood Curse, Slow Regeneration, Pattern, and Shapeshifting.';
            // Auto-enable both Pattern and Shapeshifting
            document.getElementById('pattern-adept').checked = true;
            document.getElementById('pattern-adept').disabled = true;
            document.getElementById('shapeshifting').checked = true;
            document.getElementById('shapeshifting').disabled = true;
            break;
        case 'other':
            heritageDescription = 'Credit 6 points. Work with GM to create custom heritage.';
            break;
        default:
            heritageDescription = '';
            break;
    }
    
    if (heritageDescription) {
        heritageInfo.innerHTML = heritageDescription;
        heritageInfo.style.display = 'block';
    } else {
        heritageInfo.style.display = 'none';
    }
    
    updatePointsDisplay();
    updatePowers();
    saveCharacter();
}

// Calculate heritage cost (NEW FUNCTION)
function getHeritageCost() {
    switch(character.heritage) {
        case 'recognized-amber': return 0; // Free
        case 'unrecognized-amber': return -5; // Credit 5 points
        case 'chaos': return -2; // Credit 2 points
        case 'both': return 3; // Costs 3 points
        case 'other': return -6; // Credit 6 points
        default: return 0;
    }
}

// Skills management (unchanged)
function updateSkills() {
    const skills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
    
    skills.forEach(skill => {
        const value = parseInt(document.getElementById(skill).value) || 0;
        character.skills[skill] = value;
        
        // Calculate cost (only positive values above 0 cost points)
        const cost = Math.max(0, value);
        document.getElementById(skill + 'Cost').textContent = `Cost: ${cost} points`;
    });
    
    updatePointsDisplay();
    saveCharacter();
}

// Powers management (unchanged - preserves all credit mechanics)
function updatePowers() {
    const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
    character.powers = [];
    
    powerElements.forEach(element => {
        if (element.checked) {
            character.powers.push({
                id: element.id,
                cost: parseInt(element.dataset.cost),
                prereq: element.dataset.prereq,
                credit: element.dataset.credit
            });
        }
    });
    
    // Check prerequisites and enable/disable powers
    powerElements.forEach(element => {
        const prereq = element.dataset.prereq;
        if (prereq && !element.disabled) {
            const prereqMet = document.getElementById(prereq).checked;
            element.parentElement.parentElement.classList.toggle('disabled', !prereqMet);
            if (!prereqMet && element.checked) {
                element.checked = false;
            }
        }
    });
    
    // Update power costs display
    updatePowerCosts();
    updatePointsDisplay();
    saveCharacter();
}

// Update power costs (unchanged - preserves all credit mechanics)
function updatePowerCosts() {
    const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
    
    powerElements.forEach(element => {
        const powerId = element.id;
        const baseCost = parseInt(element.dataset.cost);
        const costSpan = document.getElementById(powerId + '-cost');
        
        if (!costSpan) return;
        
        let finalCost = baseCost;
        let isFree = false;
        let isDiscounted = false;
        
        // Check if this power is free from heritage
        if (isHeritageFreePower(powerId)) {
            finalCost = 0;
            isFree = true;
        } else {
            // Apply credits from other powers
            if (element.dataset.credit && element.checked) {
                const credits = element.dataset.credit.split(',');
                credits.forEach(credit => {
                    const [powerName, creditValue] = credit.split(':');
                    const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                    if (hasPowerForCredit) {
                        finalCost += parseInt(creditValue); // creditValue is already negative
                        isDiscounted = true;
                    }
                });
            }
        }
        
        // Update the display
        costSpan.textContent = finalCost === 0 ? 'Free' : finalCost.toString();
        costSpan.className = 'power-cost';
        
        if (isFree) {
            costSpan.classList.add('free');
        } else if (isDiscounted) {
            costSpan.classList.add('discounted');
        }
    });
}

// Heritage free power check (unchanged)
function isHeritageFreePower(powerId) {
    const heritage = character.heritage;
    if (heritage === 'recognized-amber' && powerId === 'pattern-adept') return true;
    if (heritage === 'chaos' && powerId === 'shapeshifting') return true;
    if (heritage === 'both' && (powerId === 'pattern-adept' || powerId === 'shapeshifting')) return true;
    return false;
}

// Points calculation - FIXED to include heritage cost
function calculateUsedPoints() {
    let total = 0;
    
    // Add heritage cost/credit
    total += getHeritageCost();
    
    // Calculate skill costs
    Object.values(character.skills).forEach(value => {
        total += Math.max(0, value);
    });
    
    // Calculate power costs with heritage discounts and credits
    character.powers.forEach(power => {
        // Skip Ancient powers (GM determined cost)
        if (['dominion', 'essence', 'song', 'making', 'unmaking'].includes(power.id)) {
            return;
        }
        
        let powerCost = power.cost;
        
        // Apply heritage discounts first
        if (isHeritageFreePower(power.id)) {
            powerCost = 0;
        } else {
            // Apply credits only if power wasn't free from heritage
            if (power.credit) {
                const credits = power.credit.split(',');
                credits.forEach(credit => {
                    const [powerName, creditValue] = credit.split(':');
                    const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                    if (hasPowerForCredit) {
                        powerCost += parseInt(creditValue); // creditValue is already negative
                    }
                });
            }
        }
        
        total += Math.max(0, powerCost); // Don't allow negative costs
    });
    
    // Calculate extras costs (unchanged)
    character.extras.forEach(extra => {
        total += calculateExtraCost(extra);
    });
    
    return total;
}

// Update character summary - FIXED to show heritage cost
function updateCharacterSummary() {
    const summaryDiv = document.getElementById('characterSummary');
    
    let summary = '<h3>Character Overview</h3>';
    
    if (character.heritage) {
        const heritageName = character.heritage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const heritageCost = getHeritageCost();
        let costText = '';
        if (heritageCost > 0) costText = ` (${heritageCost} pts)`;
        else if (heritageCost < 0) costText = ` (${Math.abs(heritageCost)} pts credit)`;
        else costText = ' (Free)';
        
        summary += `<p><strong>Heritage:</strong> ${heritageName}${costText}</p>`;
    }
    
    // Skills summary
    summary += '<h4>Skills</h4>';
    Object.entries(character.skills).forEach(([skill, value]) => {
        if (value !== 0) {
            summary += `<p><strong>${skill.charAt(0).toUpperCase() + skill.slice(1)}:</strong> ${value >= 0 ? '+' : ''}${value}</p>`;
        }
    });
    
    // Powers summary (unchanged - preserves all credit display logic)
    if (character.powers.length > 0) {
        summary += '<h4>Powers</h4>';
        let hasAncientPowers = false;
        character.powers.forEach(power => {
            const powerName = power.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (['dominion', 'essence', 'song', 'making', 'unmaking'].includes(power.id)) {
                summary += `<p><strong>${powerName}</strong> (GM approval required)</p>`;
                hasAncientPowers = true;
            } else {
                let displayCost = power.cost;
                if (isHeritageFreePower(power.id)) {
                    displayCost = 'Free';
                } else if (power.credit) {
                    // Calculate actual cost with credits
                    let actualCost = power.cost;
                    const credits = power.credit.split(',');
                    credits.forEach(credit => {
                        const [powerName, creditValue] = credit.split(':');
                        const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                        if (hasPowerForCredit) {
                            actualCost += parseInt(creditValue);
                        }
                    });
                    displayCost = Math.max(0, actualCost);
                }
                summary += `<p><strong>${powerName}</strong> (${displayCost} pts)</p>`;
            }
        });
        
        if (hasAncientPowers) {
            summary += '<p style="color: #EFBF04; font-style: italic;">Note: Ancient powers require GM approval and custom point costs.</p>';
        }
    }
    
    // Extras summary (unchanged)
    if (character.extras.length > 0) {
        summary += '<h4>Extras</h4>';
        character.extras.forEach(extra => {
            const extraName = extra.name || 'Unnamed Extra';
            const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
            const extraCost = calculateExtraCost(extra);
            const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
            
            summary += `<p><strong>${extraName}${extraType}</strong>${costText}</p>`;
            
            if (extra.isSimple && extra.simpleAspect) {
                summary += `<p style="margin-left: 20px; font-style: italic;">Aspect: ${extra.simpleAspect}</p>`;
            } else if (!extra.isSimple && extra.features.length > 0) {
                const featureGroups = {};
                extra.features.forEach(f => {
                    if (!featureGroups[f.name]) featureGroups[f.name] = [];
                    featureGroups[f.name].push(f);
                });
                const featureList = Object.entries(featureGroups).map(([name, instances]) => {
                    if (instances.length === 1) {
                        const instance = instances[0];
                        if (name === 'Flexible' && instance.skillUsed && instance.skillReplaced) {
                            return `${name} (${instance.skillUsed}→${instance.skillReplaced})`;
                        } else if (name === 'Focus' && instance.skill) {
                            return `${name} (+2 ${instance.skill})`;
                        }
                        return name;
                    } else {
                        return `${name} (×${instances.length})`;
                    }
                }).join(', ');
                summary += `<p style="margin-left: 20px; font-style: italic;">Features: ${featureList}</p>`;
            }
        });
    }
    
    summary += `<h4>Point Allocation</h4>`;
    summary += `<p><strong>Total Available:</strong> ${character.totalPoints}</p>`;
    summary += `<p><strong>Used:</strong> ${character.usedPoints}</p>`;
    summary += `<p><strong>Good Stuff Rating:</strong> ${character.totalPoints - character.usedPoints}</p>`;
    
    summaryDiv.innerHTML = summary;
}

// Points display update (unchanged)
function updatePointsDisplay() {
    character.usedPoints = calculateUsedPoints();
    const remaining = character.totalPoints - character.usedPoints;
    
    document.getElementById('pointsRemaining').textContent = remaining;
    
    const statusDiv = document.getElementById('pointsStatus');
    if (remaining < 0) {
        statusDiv.innerHTML = '<div class="points-warning">Over Budget!</div>';
        document.getElementById('pointsRemaining').className = 'points-remaining points-warning';
    } else if (remaining === 0) {
        statusDiv.innerHTML = '<div class="success">Perfect!</div>';
        document.getElementById('pointsRemaining').className = 'points-remaining';
    } else {
        statusDiv.innerHTML = '';
        document.getElementById('pointsRemaining').className = 'points-remaining';
    }
    
    updateCharacterSummary();
}

function updateCharacterSummary() {
    const summaryDiv = document.getElementById('characterSummary');
    
    let summary = '<h3>Character Overview</h3>';
    
    if (character.heritage) {
        summary += `<p><strong>Heritage:</strong> ${character.heritage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>`;
    }
    
    // Skills summary
    summary += '<h4>Skills</h4>';
    Object.entries(character.skills).forEach(([skill, value]) => {
        if (value !== 0) {
            summary += `<p><strong>${skill.charAt(0).toUpperCase() + skill.slice(1)}:</strong> ${value >= 0 ? '+' : ''}${value}</p>`;
        }
    });
    
    // Powers summary
    if (character.powers.length > 0) {
        summary += '<h4>Powers</h4>';
        let hasAncientPowers = false;
        character.powers.forEach(power => {
            const powerName = power.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (['dominion', 'essence', 'song', 'making', 'unmaking'].includes(power.id)) {
                summary += `<p><strong>${powerName}</strong> (GM approval required)</p>`;
                hasAncientPowers = true;
            } else {
                let displayCost = power.cost;
                if (isHeritageFreePower(power.id)) {
                    displayCost = 'Free';
                } else if (power.credit) {
                    // Calculate actual cost with credits
                    let actualCost = power.cost;
                    const credits = power.credit.split(',');
                    credits.forEach(credit => {
                        const [powerName, creditValue] = credit.split(':');
                        const hasPowerForCredit = character.powers.some(p => p.id === powerName);
                        if (hasPowerForCredit) {
                            actualCost += parseInt(creditValue);
                        }
                    });
                    displayCost = Math.max(0, actualCost);
                }
                summary += `<p><strong>${powerName}</strong> (${displayCost} pts)</p>`;
            }
        });
        
        if (hasAncientPowers) {
            summary += '<p style="color: #EFBF04; font-style: italic;">Note: Ancient powers require GM approval and custom point costs.</p>';
        }
    }
    
    // Extras summary
    if (character.extras.length > 0) {
        summary += '<h4>Extras</h4>';
        character.extras.forEach(extra => {
            const extraName = extra.name || 'Unnamed Extra';
            const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
            const extraCost = calculateExtraCost(extra);
            const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
            
            summary += `<p><strong>${extraName}${extraType}</strong>${costText}</p>`;
            
            if (extra.isSimple && extra.simpleAspect) {
                const points = extra.simplePoints || 1;
                const invokes = getSimpleInvokes(extra.type) * points;
                summary += `<p style="margin-left: 20px; font-style: italic;">Aspect: ${extra.simpleAspect} (${invokes} invokes)</p>`;
            } else if (!extra.isSimple && extra.features.length > 0) {
                const featureGroups = {};
                extra.features.forEach(f => {
                    if (!featureGroups[f.name]) featureGroups[f.name] = [];
                    featureGroups[f.name].push(f);
                });
                const featureList = Object.entries(featureGroups).map(([name, instances]) => {
                    if (instances.length === 1) {
                        const instance = instances[0];
                        if (name === 'Flexible' && instance.skillUsed && instance.skillReplaced) {
                            return `${name} (${instance.skillUsed}→${instance.skillReplaced})`;
                        } else if (name === 'Focus' && instance.skill) {
                            return `${name} (+2 ${instance.skill})`;
                        }
                        return name;
                    } else {
                        return `${name} (×${instances.length})`;
                    }
                }).join(', ');
                summary += `<p style="margin-left: 20px; font-style: italic;">Features: ${featureList}</p>`;
            }
        });
    }
    
    summary += `<h4>Point Allocation</h4>`;
    summary += `<p><strong>Total Available:</strong> ${character.totalPoints}</p>`;
    summary += `<p><strong>Used:</strong> ${character.usedPoints}</p>`;
    summary += `<p><strong>Good Stuff Rating:</strong> ${character.totalPoints - character.usedPoints}</p>`;
    
    summaryDiv.innerHTML = summary;
}

// Save/Load functionality
function saveCharacter() {
    try {
        // Save form values
        const saveData = {
            ...character,
            concept: document.getElementById('concept').value,
            position: document.getElementById('position').value,
            trouble: document.getElementById('trouble').value,
            goal: document.getElementById('goal').value,
            secret: document.getElementById('secret').value,
            formValues: {
                heritage: document.getElementById('heritage').value,
                skills: {},
                powers: {}
            },
            extraIdCounter: extraIdCounter,
            featureInstanceCounter: featureInstanceCounter
        };

        // Save skill values
        const skills = ['strength', 'warfare', 'psyche', 'endurance', 'status', 'intrigue', 'hunting', 'lore'];
        skills.forEach(skill => {
            saveData.formValues.skills[skill] = document.getElementById(skill).value;
        });

        // Save power selections
        const powerElements = document.querySelectorAll('input[type="checkbox"][data-cost]');
        powerElements.forEach(element => {
            saveData.formValues.powers[element.id] = element.checked;
        });

        localStorage.setItem('amberCharacter', JSON.stringify(saveData));
        document.getElementById('saveStatus').textContent = 'Saved ✓';
        setTimeout(() => {
            document.getElementById('saveStatus').textContent = '';
        }, 2000);
    } catch (error) {
        console.error('Save failed:', error);
        document.getElementById('saveStatus').textContent = 'Save failed!';
    }
}

function loadCharacter() {
    try {
        const saved = localStorage.getItem('amberCharacter');
        if (!saved) return;

        const saveData = JSON.parse(saved);
        
        // Restore form values
        if (saveData.concept) document.getElementById('concept').value = saveData.concept;
        if (saveData.position) document.getElementById('position').value = saveData.position;
        if (saveData.trouble) document.getElementById('trouble').value = saveData.trouble;
        if (saveData.goal) document.getElementById('goal').value = saveData.goal;
        if (saveData.secret) document.getElementById('secret').value = saveData.secret;

        // Restore heritage
        if (saveData.formValues && saveData.formValues.heritage) {
            document.getElementById('heritage').value = saveData.formValues.heritage;
            updateHeritage();
        }

        // Restore skills
        if (saveData.formValues && saveData.formValues.skills) {
            Object.entries(saveData.formValues.skills).forEach(([skill, value]) => {
                if (document.getElementById(skill)) {
                    document.getElementById(skill).value = value;
                }
            });
            updateSkills();
        }

        // Restore powers
        if (saveData.formValues && saveData.formValues.powers) {
            Object.entries(saveData.formValues.powers).forEach(([powerId, checked]) => {
                const element = document.getElementById(powerId);
                if (element) {
                    element.checked = checked;
                }
            });
            updatePowers();
        }

        // Restore extras
        if (saveData.extras) {
            character.extras = saveData.extras;
            extraIdCounter = saveData.extraIdCounter || 0;
            featureInstanceCounter = saveData.featureInstanceCounter || 0;
            
            // Ensure all extras have an isEditing state (default to false for loaded extras)
            // and simplePoints property for backward compatibility
            character.extras.forEach(extra => {
                if (extra.isEditing === undefined) {
                    extra.isEditing = false;
                }
                if (extra.simplePoints === undefined) {
                    extra.simplePoints = 1;
                }
            });
            
            // Clear existing extras display
            document.getElementById('extrasContainer').innerHTML = '';
            
            // Re-render all extras
            character.extras.forEach(extra => {
                renderExtra(extra);
            });
        }

        document.getElementById('saveStatus').textContent = 'Loaded previous save ✓';
        setTimeout(() => {
            document.getElementById('saveStatus').textContent = '';
        }, 3000);
    } catch (error) {
        console.error('Load failed:', error);
    }
}

function resetCharacter() {
    if (confirm('Are you sure you want to reset all character data? This cannot be undone.')) {
        localStorage.removeItem('amberCharacter');
        location.reload();
    }
}

function exportCharacter() {
    // Collect all form data
    const exportData = {
        ...character,
        concept: document.getElementById('concept').value,
        position: document.getElementById('position').value,
        trouble: document.getElementById('trouble').value,
        goal: document.getElementById('goal').value,
        secret: document.getElementById('secret').value
    };
    
    // Create a formatted text version
    let output = '=== ANCIENT SECRETS CHARACTER SHEET ===\n\n';
    output += `Heritage: ${exportData.heritage}\n`;
    output += `Concept: ${exportData.concept}\n`;
    output += `Position: ${exportData.position}\n`;
    output += `Trouble: ${exportData.trouble}\n`;
    output += `Goal: ${exportData.goal}\n`;
    output += `Secret: ${exportData.secret}\n\n`;
    
    output += '=== SKILLS ===\n';
    Object.entries(exportData.skills).forEach(([skill, value]) => {
        output += `${skill.charAt(0).toUpperCase() + skill.slice(1)}: ${value >= 0 ? '+' : ''}${value}\n`;
    });
    
    if (exportData.powers.length > 0) {
        output += '\n=== POWERS ===\n';
        exportData.powers.forEach(power => {
            const powerName = power.id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (['dominion', 'essence', 'song', 'making', 'unmaking'].includes(power.id)) {
                output += `${powerName} (GM approval required)\n`;
            } else {
                let displayCost = power.cost;
                if (isHeritageFreePower(power.id)) {
                    displayCost = 'Free';
                } else if (power.credit) {
                    let actualCost = power.cost;
                    const credits = power.credit.split(',');
                    credits.forEach(credit => {
                        const [powerName, creditValue] = credit.split(':');
                        const hasPowerForCredit = exportData.powers.some(p => p.id === powerName);
                        if (hasPowerForCredit) {
                            actualCost += parseInt(creditValue);
                        }
                    });
                    displayCost = Math.max(0, actualCost);
                }
                output += `${powerName} (${displayCost} pts)\n`;
            }
        });
    }
    
    if (exportData.extras.length > 0) {
        output += '\n=== EXTRAS ===\n';
        exportData.extras.forEach(extra => {
            const extraName = extra.name || 'Unnamed Extra';
            const extraType = extra.type ? ` (${extra.type.charAt(0).toUpperCase() + extra.type.slice(1)})` : '';
            const extraCost = calculateExtraCost(extra);
            const costText = extraCost > 0 ? ` - ${extraCost} pts` : extraCost < 0 ? ` - Credits ${Math.abs(extraCost)} pts` : '';
            
            output += `${extraName}${extraType}${costText}\n`;
            
            if (extra.isSimple && extra.simpleAspect) {
                const points = extra.simplePoints || 1;
                const invokes = getSimpleInvokes(extra.type) * points;
                output += `  Aspect: ${extra.simpleAspect} (${invokes} invokes)\n`;
            } else if (!extra.isSimple && extra.features.length > 0) {
                const featureGroups = {};
                extra.features.forEach(f => {
                    if (!featureGroups[f.name]) featureGroups[f.name] = [];
                    featureGroups[f.name].push(f);
                });
                
                Object.entries(featureGroups).forEach(([name, instances]) => {
                    if (instances.length === 1) {
                        const instance = instances[0];
                        output += `  ${name}`;
                        if (name === 'Flexible' && instance.skillUsed && instance.skillReplaced) {
                            output += `: Use ${instance.skillUsed} in place of ${instance.skillReplaced}`;
                            if (instance.circumstance) {
                                output += ` when ${instance.circumstance}`;
                            }
                        } else if (name === 'Focus' && instance.skill) {
                            output += `: +2 to ${instance.skill}`;
                            if (instance.circumstance) {
                                output += ` when ${instance.circumstance}`;
                            }
                        } else if (instance.description) {
                            output += `: ${instance.description}`;
                        } else if (instance.ability) {
                            output += `: ${instance.ability}`;
                        }
                        output += '\n';
                    } else {
                        output += `  ${name} (×${instances.length})\n`;
                        instances.forEach((instance, i) => {
                            output += `    #${i + 1}`;
                            if (name === 'Flexible' && instance.skillUsed && instance.skillReplaced) {
                                output += `: Use ${instance.skillUsed} in place of ${instance.skillReplaced}`;
                                if (instance.circumstance) {
                                    output += ` when ${instance.circumstance}`;
                                }
                            } else if (name === 'Focus' && instance.skill) {
                                output += `: +2 to ${instance.skill}`;
                                if (instance.circumstance) {
                                    output += ` when ${instance.circumstance}`;
                                }
                            } else if (instance.description) {
                                output += `: ${instance.description}`;
                            } else if (instance.ability) {
                                output += `: ${instance.ability}`;
                            }
                            if (instance.skillMods && instance.skillMods.length > 0) {
                                const skillList = instance.skillMods.map(sm => `${sm.skill}(${sm.value >= 0 ? '+' : ''}${sm.value})`).join(', ');
                                output += ` - Skills: ${skillList}`;
                            }
                            output += '\n';
                        });
                    }
                });
            }
        });
    }
    
    output += `\n=== POINT SUMMARY ===\n`;
    output += `Total Available: ${exportData.totalPoints}\n`;
    output += `Used: ${exportData.usedPoints}\n`;
    output += `Good Stuff Rating: ${exportData.totalPoints - exportData.usedPoints}\n`;
    
    // Create downloadable file
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ancient-secrets-character.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize and set up auto-save
document.addEventListener('DOMContentLoaded', function() {
    loadCharacter();
    updatePointsDisplay();
    
    // Add event listeners for text inputs
    const textInputs = ['concept', 'position', 'trouble', 'goal', 'secret'];
    textInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
            element.addEventListener('input', saveCharacter);
            element.addEventListener('blur', saveCharacter);
        }
    });
});