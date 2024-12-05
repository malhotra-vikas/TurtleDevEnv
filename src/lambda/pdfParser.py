import fitz  # PyMuPDF

# File paths
pdf_path = "/Users/vikas/Desktop/LeaseWisely/11456 N 57th Lease.pdf"
text_path = "/Users/vikas/Desktop/LeaseWisely/11456_N_57th_Lease.txt"

# Open the PDF file
pdf_document = fitz.open(pdf_path)

# Create a new text file to write the extracted text
with open(text_path, "w", encoding="utf-8") as text_file:
    # Iterate through each page
    for page_num in range(pdf_document.page_count):
        page = pdf_document.load_page(page_num)  # Load page
        text = page.get_text("text")  # Extract text as string
        text_file.write(f"Page {page_num + 1} of {pdf_document.page_count}\n")
        text_file.write(text)
        text_file.write("\n" + "-" * 80 + "\n")

print(f"Text has been extracted and written to {text_path}")
