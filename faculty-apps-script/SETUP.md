# Faculty Commons Apps Script setup

1. Go to Google Apps Script and create a new standalone project.
2. Name the project **LACCD English Faculty Commons**.
3. Keep the script file named **Code.gs**.
4. Replace the contents of Code.gs with the included `Code.gs`.
5. Save.
6. Select `setupFacultyCommons` and click **Run** once.
7. Approve the Google permissions when prompted.
8. The setup creates:
   - a public **Join the Faculty Commons** Google Form
   - a public **Update or Remove My Profile** Google Form
   - one private Google Sheet for moderation and requests
9. In the response Sheet, a profile appears publicly only after **Approved = Yes**.
10. Deploy the Apps Script as a **Web app**:
    - Execute as: **Me**
    - Who has access: **Anyone**
11. Run `getSetupInfo()` after deployment.
12. Copy the returned `feedUrl`, `joinUrl`, and `changeUrl` into the `LACCD_ENGLISH_FACULTY` block in the website `config.js`.

Do not publish the private Google Sheet. The public web app returns only approved, explicitly public profile fields.
