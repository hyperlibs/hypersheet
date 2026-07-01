from setuptools import setup, find_packages

setup(
    name="Hypersheet",
    version="0.1.0",
    description="Hypersheet Python backend - HTML-first spreadsheet grid with Casbin column security",
    license="MIT",
    packages=find_packages(),
    install_requires=[
        "jinja3>=3.1",
        "markupsafe>=2.1",
        "casbin>=1.30",
    ],
    python_requires=">=3.9",
)
