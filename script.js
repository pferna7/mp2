// keep all js in strict mode just to avoid silly mistakes
'use strict';

// small Course class that wraps each course object
class Course {
    constructor(raw) {
        // grab each property from the raw json object
        // if something is missing or null, we give a gentle default
        this.id = raw.id || 'Unknown ID';
        this.title = raw.title || 'Untitled course';
        this.department = raw.department || 'Unknown department';
        this.level = raw.level || null;
        this.credits = raw.credits || null;
        this.instructor = raw.instructor || null;
        this.description = raw.description || 'No description available.';
        this.semester = raw.semester || 'Unknown semester';
    }

    // this helper returns a cleaned instructor string
    getInstructorLabel() {
        // if instructor is missing we just say TBA
        return this.instructor ? this.instructor : 'TBA';
    }
}

// make some arrays to hold our data
let allCourses = [];        // everything from the json file lives here
let filteredCourses = [];   // this is the stuff we actually show in the list

// grab all the elements we need from the page once
const fileInput = document.getElementById('file-input');
const fileNameSpan = document.getElementById('file-name');
const errorMessage = document.getElementById('error-message');

const departmentSelect = document.getElementById('filter-department');
const levelSelect = document.getElementById('filter-level');
const creditsSelect = document.getElementById('filter-credits');
const instructorSelect = document.getElementById('filter-instructor');
const sortSelect = document.getElementById('sort-by');

const courseListDiv = document.getElementById('course-list');
const courseDetailsDiv = document.getElementById('course-details');

// add change listener when user picks a file
fileInput.addEventListener('change', (event) => {
    // get the first file (we only expect one)
    const file = event.target.files[0];

    // if user cancels the dialog there will be no file
    if (!file) {
        return;
    }

    // show the file name beside the input so user knows what they picked
    fileNameSpan.textContent = file.name;

    // create a FileReader to read the file as text
    const reader = new FileReader();

    // when the file is loaded we try to parse the json
    reader.onload = () => {
        try {
            // reader.result is just a string, so we parse it here
            const jsonData = JSON.parse(reader.result);

            // we expect an array of course objects in the file
            if (!Array.isArray(jsonData)) {
                throw new Error('JSON root is not an array');
            }

            // clear out any previous data
            allCourses = [];
            filteredCourses = [];

            // convert each raw object into a Course instance
            jsonData.forEach((courseObj) => {
                allCourses.push(new Course(courseObj));
            });

            // update our dropdowns based on the new data
            populateFilterDropdowns();

            // now that we have courses we apply filters/sort (defaults) and render
            applyFiltersAndSort();

            // clear any previous error message
            setError(''); // empty string hides the message
        } catch (err) {
            // if anything goes wrong parsing, we show the rubric-style message
            setError('Invalid JSON file format.');
            // also clear any leftover data on the page so it doesn't look half‑broken
            allCourses = [];
            filteredCourses = [];
            renderCourseList();
            renderCourseDetails(null);
            console.error(err); // log full error to browser console for debugging
        }
    };

    // if reading the file itself fails for some reason we handle that too
    reader.onerror = () => {
        setError('Could not read file. please try again.');
    };

    // actually start reading the file here
    reader.readAsText(file);
});

// helper to show or hide the error message text
function setError(message) {
    if (!message) {
        // no message means we hide the error paragraph
        errorMessage.textContent = '';
        errorMessage.classList.add('hidden');
    } else {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }
}

// this function looks at all courses and fills each dropdown
function populateFilterDropdowns() {
    // use Sets so we only keep unique values
    const departments = new Set();
    const levels = new Set();
    const credits = new Set();
    const instructors = new Set();

    // go through all the courses and collect values
    allCourses.forEach((course) => {
        departments.add(course.department);

        // we only add level or credits if we actually have them
        if (course.level !== null && course.level !== undefined) {
            levels.add(course.level);
        }
        if (course.credits !== null && course.credits !== undefined) {
            credits.add(course.credits);
        }

        // for instructors we reuse the label helper so "TBA" shows up once
        instructors.add(course.getInstructorLabel());
    });

    // once we have sets, we clear existing options (except the "All" one)
    resetSelectOptions(departmentSelect, 'All');
    resetSelectOptions(levelSelect, 'All');
    resetSelectOptions(creditsSelect, 'All');
    resetSelectOptions(instructorSelect, 'All');

    // helper to turn a Set into sorted array
    const sortedDepartments = Array.from(departments).sort();
    const sortedLevels = Array.from(levels).sort((a, b) => a - b); // numeric sort
    const sortedCredits = Array.from(credits).sort((a, b) => a - b); // numeric sort
    const sortedInstructors = Array.from(instructors).sort();

    // now we make <option> for each one

    sortedDepartments.forEach((dep) => {
        const opt = document.createElement('option');
        opt.value = dep;
        opt.textContent = dep;
        departmentSelect.appendChild(opt);
    });

    sortedLevels.forEach((lev) => {
        const opt = document.createElement('option');
        opt.value = String(lev);
        opt.textContent = lev;
        levelSelect.appendChild(opt);
    });

    sortedCredits.forEach((cr) => {
        const opt = document.createElement('option');
        opt.value = String(cr);
        opt.textContent = cr;
        creditsSelect.appendChild(opt);
    });

    sortedInstructors.forEach((inst) => {
        const opt = document.createElement('option');
        opt.value = inst;
        opt.textContent = inst;
        instructorSelect.appendChild(opt);
    });
}

// tiny helper to keep only the first option ("All") in a <select>
function resetSelectOptions(selectElement, allLabel) {
    // set the first option's text, then remove any extras
    selectElement.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = 'All';
    allOption.textContent = allLabel;
    selectElement.appendChild(allOption);
}

// whenever the user changes any filter or sort we update the list
[departmentSelect, levelSelect, creditsSelect, instructorSelect, sortSelect]
    .forEach((sel) => {
        sel.addEventListener('change', () => {
            applyFiltersAndSort();
        });
    });

// this function does two things: applies all filters, then sorts the result
function applyFiltersAndSort() {
    if (allCourses.length === 0) {
        // if we have no data yet, there's nothing to do
        renderCourseList();
        renderCourseDetails(null);
        return;
    }

    // read current filter values
    const deptValue = departmentSelect.value;
    const levelValue = levelSelect.value;
    const creditsValue = creditsSelect.value;
    const instructorValue = instructorSelect.value;
    const sortValue = sortSelect.value;

    // step 1: filter using the array filter method (as requested by rubric)
    filteredCourses = allCourses.filter((course) => {
        // check each filter; if it's set to "All" we don't restrict on that field
        const matchesDept = (deptValue === 'All') || (course.department === deptValue);

        const matchesLevel = (levelValue === 'All') ||
            (String(course.level) === levelValue);

        const matchesCredits = (creditsValue === 'All') ||
            (String(course.credits) === creditsValue);

        const matchesInstructor = (instructorValue === 'All') ||
            (course.getInstructorLabel() === instructorValue);

        // course must pass all active filters
        return matchesDept && matchesLevel && matchesCredits && matchesInstructor;
    });

    // step 2: sort the filtered results based on dropdown choice
    sortCourses(filteredCourses, sortValue);

    // finally update the DOM with the new list
    renderCourseList();
    // show details for the first course (if any) so right panel is never empty
    if (filteredCourses.length > 0) {
        renderCourseDetails(filteredCourses[0]);
        markSelectedCourse(filteredCourses[0].id);
    } else {
        renderCourseDetails(null);
    }
}

// this function mutates the array in place so we stay efficient
function sortCourses(coursesArray, sortValue) {
    // if user picked "None" we just keep the original filtered order
    if (sortValue === 'none') {
        return; // no work to do
    }

    // helper for comparing semester strings like "Fall 2025"
    const semesterToNumber = (semString) => {
        if (!semString) {
            return 0; // unknown semesters get lowest value
        }
        const parts = semString.split(' ');
        const term = parts[0];
        const year = parseInt(parts[1], 10) || 0;

        // we map the four terms to an order number
        let termOrder = 0;
        switch (term) {
            case 'Winter':
                termOrder = 1;
                break;
            case 'Spring':
                termOrder = 2;
                break;
            case 'Summer':
                termOrder = 3;
                break;
            case 'Fall':
                termOrder = 4;
                break;
            default:
                termOrder = 0;
        }

        // multiply year by 10 just to keep space between years
        return year * 10 + termOrder;
    };

    // now we choose how to sort based on the selected option
    coursesArray.sort((a, b) => {
        // we switch on sortValue and return different comparisons
        switch (sortValue) {
            case 'id-asc':
                return a.id.localeCompare(b.id);
            case 'id-desc':
                return b.id.localeCompare(a.id);
            case 'title-asc':
                return a.title.localeCompare(b.title);
            case 'title-desc':
                return b.title.localeCompare(a.title);
            case 'sem-earliest':
                return semesterToNumber(a.semester) - semesterToNumber(b.semester);
            case 'sem-latest':
                return semesterToNumber(b.semester) - semesterToNumber(a.semester);
            default:
                // unknown option -> no change
                return 0;
        }
    });
}

// this function renders the list of course ids on the left
function renderCourseList() {
    // clear previous list
    courseListDiv.innerHTML = '';

    if (filteredCourses.length === 0) {
        // if nothing passes the filters, show a gentle message
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent = 'no courses match the current filters.';
        courseListDiv.appendChild(emptyMsg);
        return;
    }

    // for each course we make a button-like div
    filteredCourses.forEach((course) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'course-item';
        item.textContent = course.id; // just the id like "CS310"

        // when you click a course, we show its details
        item.addEventListener('click', () => {
            renderCourseDetails(course);
            markSelectedCourse(course.id);
        });

        courseListDiv.appendChild(item);
    });
}

// little helper to visually mark which course is currently selected
function markSelectedCourse(courseId) {
    const items = courseListDiv.querySelectorAll('.course-item');
    items.forEach((item) => {
        if (item.textContent === courseId) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// this function fills the right-hand details panel
function renderCourseDetails(course) {
    // if no course is provided we show a placeholder
    if (!course) {
        courseDetailsDiv.classList.add('course-details-placeholder');
        courseDetailsDiv.innerHTML = '<p>no course selected. try changing your filters or loading a json file.</p>';
        return;
    }

    // once we have real content we don't need the placeholder style anymore
    courseDetailsDiv.classList.remove('course-details-placeholder');

    // build a simple block of html similar to the provided screenshot
    courseDetailsDiv.innerHTML = `
        <h2>${course.id}</h2>
        <p><strong>Title:</strong> ${course.title}</p>
        <p><strong>Department:</strong> ${course.department}</p>
        <p><strong>Level:</strong> ${course.level !== null ? course.level : 'n/a'}</p>
        <p><strong>Credits:</strong> ${course.credits !== null ? course.credits : 'n/a'}</p>
        <p><strong>Instructor:</strong> ${course.getInstructorLabel()}</p>
        <p><strong>Semester:</strong> ${course.semester}</p>
        <p>${course.description}</p>
    `;
}
