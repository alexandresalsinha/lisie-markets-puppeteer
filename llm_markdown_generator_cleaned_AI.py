import os
import asyncio
import argparse
import json
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai import LLMConfig
from crawl4ai.content_filter_strategy import LLMContentFilter
import config # Assuming config.py can be imported for provider mappings
import subprocess

#python3 .\llm_markdown_generator_cleaned_AI.py --url https://www.minipreco.pt/produtos/bebidas-e-garrafeira/cervejas-e-sidras/especiais/p/40102 --storeId "5"
#python3 .\llm_markdown_generator_cleaned_AI.py --url https://www.auchan.pt/pt/beleza-e-higiene/champo-e-coloracao/champo-tratamento/champo-syoss-volume-440ml/934685.html --storeId "1"
#python3 .\llm_markdown_generator_cleaned_AI.py --url "https://www.auchan.pt/pt/beleza-e-higiene/champo-e-coloracao/champo-tratamento/champo-syoss-volume-440ml/934685.html" --storeId "1" --llm_provider "ollama/llama3.2"
#python3 .\llm_markdown_generator_cleaned_AI.py --url "https://www.auchan.pt/pt/beleza-e-higiene/champo-e-coloracao/champo-tratamento/champo-syoss-volume-440ml/934685.html" --storeId "1" --llm_provider "ollama/llama4"
#python3 .\llm_markdown_generator_cleaned_AI.py --url "https://www.continente.pt/produto/detergente-maquina-roupa-liquido-active-clean-skip-7778803.html" --storeId "2"
#python3 .\llm_markdown_generator_cleaned_AI.py --url "https://www.pingodoce.pt/home/produtos/animais/gato/higiene-e-acessorios/areia-aglomerante-kitty-971116.html" --storeId "3"
#python3 .\llm_markdown_generator_cleaned_AI.py --url "https://loja-online.intermarche.pt/product/batata-frita-lisas-originais-embalagem-de-160g/5601363012683" --storeId "4"
#python3 .\llm_markdown_generator_cleaned_AI.py --url "/product/ean/8001090134226" --storeId "4" --llm_provider "ollama/llama4"
#python3 .\llm_markdown_generator_cleaned_AI.py --url "/product/ketchup-top-down-570g/8715700017006" --storeId "4"
#python3 .\llm_markdown_generator_cleaned_AI.py --url "https://www.elcorteingles.pt/espaco-saude/A40327623-serum-salicilico-anti-imperfeicoes-vinopure-caudalie/?parentCategoryId=5007.20898017024&color=Sin+especificar" --storeId "5"
#python3 .\llm_markdown_generator_cleaned_AI.py --url "https://www.aldi.pt/oportunidades-da-semana/a-partir-de-2-f-14-7/vinagre-nao-filtrado-biologico-7002628-2-0.article.html" --storeId "6"


async def main():
    parser = argparse.ArgumentParser(description="Crawl a URL and filter content using an LLM.")
    parser.add_argument("--url", type=str, 
                        # default="https://www.continente.pt/produto/detergente-maquina-roupa-liquido-active-clean-skip-7778803.html",
                        default="https://www.elcorteingles.pt/espaco-saude/A40327623-serum-salicilico-anti-imperfeicoes-vinopure-caudalie/?parentCategoryId=5007.20898017024&color=Sin+especificar",
                        help="URL to crawl.")
    parser.add_argument("--storeId", type=int, 
                        default="5",
                        help="StoreId 1-Auchan, 2-Continenete, 3.Pingo Doce, 4. Intermarche, 5. Mini Preço, 6. Aldi, 7. El Corte Ingles ")
    parser.add_argument("--llm_provider", type=str, 
                        # default="gemini/gemini-2.0-flash-exp",
                        default="ollama/gemma4:e2b",
                        help="LLM provider in 'company/model' format (e.g., 'openai/gpt-4o-mini', 'ollama/llama3.2').")
    parser.add_argument("--api_key", type=str, 
                        default="AIzaSyC2lLBOmSA4sWLDjW4sn6mkaD7AQTidheQ",
                        help="Provider Api Key (no-token-needed, api_key)")
    args = parser.parse_args()

    url = args.url
    llm_provider = args.llm_provider

    # Determine API token based on provider
    api_token = None
    provider_prefix = llm_provider.split('/')[0]
    api_token = args.api_key
    
    # Special handling for Ollama if 'no-token-needed'
    if api_token == "no-token-needed":
        api_token = None

    browser_config = BrowserConfig(
         browser_type="chromium",
        headless=False,
        # headless=True,
        verbose=True,
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/116.0.0.0 Safari/537.36",
        java_script_enabled=True
    )

    run_config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, magic=True, remove_overlay_elements=True, wait_until="load")
    
    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            print(f"Crawling URL: {url}")
            file_path = 'intermarche_html.html'
            s = ''
            
            if args.storeId == 4:
                

                # Check if the file exists before deleting
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print("File deleted successfully.")
                else:
                    print("The file does not exist.")
                # 1. Run the Node.js app (replace 'app.js' with your script and add args as needed)
                subprocess.run(['node', 'getProductMetadata.js', url, '4'])
                with open('intermarche_html.html', 'r', encoding='utf-8') as f: s = f.read()
                html = s
            else:
                result = await crawler.arun(url, config=run_config)
                html = result.cleaned_html

            #result = await crawler.arun(url, config=run_config)

            #print(s)

            #result = await crawler.arun(url, config=run_config)
            # html = result.cleaned_html
            # html = s

            instruction = """
            Extract product information from HTML including structured data, and return it in json. 
            The json must only contain this fields: product name as name, product price, product brand, product weight, product category, product recomended price(discount), product barcode.
            Add url as a property in the json.
            """

            # Initialize LLM filter
            llm_config = LLMConfig(provider=llm_provider, api_token=api_token)
            filter = LLMContentFilter(llm_config=llm_config, instruction=instruction, verbose=True)
            
            # print(f"Applying LLM filter with provider: {llm_provider}")
            filtered_content = filter.filter_content(html)
            
            # print("\nFiltered Content Length:", len(filtered_content))
            
            output_filename = "filtered_content.txt"
            if filtered_content:
                full_content_string = "\n".join(filtered_content)
                
                # Attempt to parse as JSON
                try:
                    json_output = json.loads(full_content_string)
                    output_filename = "filtered_content.json"
                    with open(output_filename, "w", encoding="utf-8") as f:
                        json.dump(json_output, f, indent=4)
                    print(f"Filtered content saved as JSON to {output_filename}")
                    # print("\nFirst 500 chars of filtered content:")
                    print(full_content_string)
                except json.JSONDecodeError:
                    print("Warning: LLM output is not valid JSON. Saving as plain text.")
                    with open(output_filename, "w", encoding="utf-8") as f:
                        f.write(full_content_string)
                    print(f"Filtered content saved as plain text to {output_filename}")
                    print("\n filtered content:")
                    print(full_content_string)
            else:
                print("No filtered content received.")
            
            filter.show_usage()

    except Exception as e:
        print(f"An error occurred: {e}")
       
if __name__ == "__main__":
    asyncio.run(main())
