# Nibbot Reporting Console Documentation

This document provides a comprehensive overview of the **Reporting Console** functionality, key terminology, and test cases to ensure accurate data analysis.

---

## **1. General Concepts**

The Reporting Console is designed for high-level performance monitoring and deep operational analysis. It aggregates data from interaction logs and support submissions to provide actionable insights.

### **Core Terms**
- **Interaction**: Any event where a user interacts with the bot (e.g., clicking a menu, sending a message).
- **Unique User**: A distinct session ID or User ID that has interacted with the system within the selected time range.
- **Submission**: A completed report or KYC form submitted via an **Internal Support Menu**.
- **Success Rate**: The percentage of interactions that completed without a system error or failure.
- **Latency (ms)**: The time taken by the server to process a request, specifically for **API Menus**.
- **Conversion Rate**: The percentage of users who opened an **Internal Support Menu** and successfully completed a submission.
- **Escalation Path**: The complete history of support user assignments for a single submission, from first assignment to resolution.

---

## **2. Functionality Overview**

### **2.1 General Report (Summary View)**
The **General Report** provides an executive-level summary of system health.

- **Total Metrics**: Quick-glance cards for Interactions, Unique Users, Submissions, and Success Rate.
- **Traffic Dynamics**: An area chart visualizing the volume of total activity vs. successful conversions (submissions) over the selected period.

### **2.2 Detail Report (Hierarchical View)**
The **Detail Report** allows for granular analysis of specific menu nodes.

#### **Categorized Menus**
Activity is automatically grouped into three professional categories:
1. **Static Menu**: Tracks purely informational interactions (FAQs, instructions).
2. **API Menu**: Tracks live integrations. Displays **Average Latency** to monitor third-party service health.
3. **Internal Support Menu**: Tracks operational workflow.
   - **Category Level**: Displays the total sum of Pending, Reviewed, and Resolved cases for all support menus.
   - **Menu Level**: Displays specific status counts (PND, REV, RES) for each individual support node.

### **2.3 Submission Analytics (Deep Insights View)**
The **Submission Analytics** tab provides detailed, report-level insights, including support workflow tracking.

#### **Key Features**
- **Submission Info**: Basic details including report ID, menu name, and timestamp.
- **Escalation Path**: Visual timeline of all support user assignments, showing:
  - Color-coded badges for first assignments (blue) and escalations (red).
  - Hover tooltips for escalation reasons.
  - Visual arrows (`→`) indicating the progression.
  - Final resolution status and resolver information (green).
- **User Rating**: Star rating (1-5 stars) provided by the user after the report is resolved.
- **Feedback**: Verbatim user feedback about their support experience.

### **2.4 Date Filtering**
Users can toggle data views between:
- **Today**: Data from 00:00 to the current time.
- **Week**: Data from the start of the current week.
- **Month**: Data from the start of the current month.
- **Custom**: A flexible date picker for historical analysis.

### **2.5 Data Export**
Professional data extraction in CSV format for both report types:
- **Detail Report CSV**: Hierarchical file containing Category totals followed by granular Menu details.
- **Submission Analytics CSV**: Clean, report-by-report export including:
  - Report ID, Timestamp, Menu Name, User ID
  - Status, Priority
  - **Escalation Path** (formatted as `User1 -> User2 -> User3 (Resolved)`)
  - Resolved By, Rating, Feedback

---

## **3. Escalation Path Workflow**

### **How it Works**
The Escalation Path tracks every assignment change made to a report:

1. **Initial Assignment**
   - If a menu is configured with a default support user, this is automatically recorded as the first assignment.
   - If a report is initially unassigned, the first manual assignment is recorded as the "first_assignment".

2. **Reassignments (Escalations)**
   - When a report is moved from one support user to another, it's recorded as an "escalation".
   - An escalation reason is **required** for manual escalations.
   - The reason is stored and visible in the Escalation Path.

3. **Resolution**
   - When a report is marked as "Resolved", the resolver is recorded.
   - If the resolver is not already in the Escalation Path, they are added as the final step.

### **Data Storage**
The assignment history is stored in the `UserReport.data.assignmentHistory` array with:
- `assignee`: The support user assigned
- `assignedBy`: The admin who made the assignment
- `assignedAt`: Timestamp of the assignment
- `type`: "first_assignment" or "escalation"
- `reason`: Reason for escalation (if applicable)

---

## **4. Test Cases**

Use these test cases to verify the integrity of the reporting data.

### **Test Case 1: Interaction Counting**
- **Action**: Open the chat and click a **Static Menu** (e.g., "About Us").
- **Expected Result**: 
  - **General Report**: "Interactions" count increases by 1.
  - **Detail Report**: Under "Static Menu", the specific menu node's "Volume" increases by 1.

### **Test Case 2: Support Lifecycle Tracking**
- **Action**: Submit a new report via an **Internal Support Menu** configured with a default support user.
- **Expected Result**: 
  - **General Report**: "Submissions" count increases by 1.
  - **Detail Report**: Under "Internal Support Menu", the category-level "Pending" count increases by 1, and the specific menu's "PND" badge increases by 1.
  - **Submission Analytics**: The report appears with the default support user in the Escalation Path.
- **Follow-up**: Assign the report to a different support user (escalation) with a reason.
- **Expected Result**: 
  - Submission Analytics shows the escalation in the Escalation Path with the reason available on hover.
- **Follow-up**: Update the report status to "Resolved".
- **Expected Result**: 
  - Detail Report: "Pending" count decreases and "Resolved" count increases.
  - Submission Analytics: Shows the resolver as the final step.

### **Test Case 3: API Performance Monitoring**
- **Action**: Trigger an **API Menu** that connects to a slow external service.
- **Expected Result**: 
  - **Detail Report**: The "Avg Response" column for that menu reflects the measured latency in milliseconds.

### **Test Case 4: Unique User Aggregation**
- **Action**: Perform 5 different interactions within the same chat session.
- **Expected Result**: 
  - **General Report**: "Interactions" increases by 5, but "Unique Users" increases by only 1.

### **Test Case 5: Export Consistency**
- **Action**: Click "Export Data" -> "Download as CSV" while on "Submission Analytics".
- **Expected Result**: 
  - The downloaded CSV contains a column named "Escalation Path".
  - The path shows the complete assignment history in a clean `User1 -> User2` format.
  - Resolved reports show `(Resolved)` next to the final resolver.

---

## **5. Technical Implementation Notes**

- **Matching Logic**: The system uses case-insensitive, normalized matching for menu names to ensure logs and database records align perfectly.
- **Security**: Data fetching is role-aware. Non-admin users are restricted to data they have permission to view.
- **Performance**: Large datasets (up to 500 records per fetch) are optimized using synchronized time windows to ensure charts and tables remain in sync.
- **Escalation Validation**: The system validates that:
  - First assignments do not require a reason.
  - Escalations **do** require a reason.
  - The assignment type is appropriate for the report's current state.
- **Data Persistence**: Assignment history is stored within the report's `data` JSON field for durability and easy retrieval.
- **CSV Safety**: All exported fields are properly escaped to handle special characters, spaces, and quotes.
