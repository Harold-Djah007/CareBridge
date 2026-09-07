# Product OS runtime regression fix

This patch isolates the authenticated Product OS shell from the legacy portal layout classes and extends CI with authenticated patient API and Socket.IO runtime smoke tests. It specifically covers the regression where the new workspace collapsed into a narrow column and where a compile-only CI run could pass despite runtime 500 responses.
