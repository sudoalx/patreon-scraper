import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { formatDate, parseArgs } from "./util";
import { DataEntity, PostFile, Embed } from "./PostDataInterface";
import { Comment, IncludedEntity } from "./Comments";

function renderPostFile(postFile: PostFile): string {
  const isImage = !!postFile.url.match(/\.(jpe?g|png|gif|bmp)/);
  if (isImage) {
    return `<div class="flex flex-col justify-center items-center w-full">
        <img src="${postFile.url}" alt="${postFile.name}" class="rounded shadow-lg mb-4 w-full md:w-2/3"/>
        <a href="${postFile.url}" class="text-blue-400 hover:underline">View full size</a>
    </div>`;
  }
  return `<div class="post_file">Linked file: <a href="${postFile.url}" class="text-blue-400 hover:underline">${postFile.name}</a></div>`;
}

function renderEmbed(embed: Embed, post_type: string, index: number): string {
  let html = "";
  if (post_type === "video_embed") {
    let video = embed.html.replace('"//', '"https://');
    // add styles to make the video responsive and fit the container
    video = video.replace("<iframe", '<iframe class="w-full h-full" style = "aspect-ratio: 16/9"');
    html += `<div class="my-4">
      <button onclick="loadVideo(${index})" class="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600">
        Load embed
      </button>
      <template class="video" id="video-${index}">${video}</template>
    </div>`;
  }
  if (embed.url) {
    html += `<br><a href="${embed.url}" class="text-blue-400 hover:underline">${embed.url}</a>`;
  }
  return html;
}

function renderComment(comment: Comment, included: IncludedEntity[]): string {
  const {
    attributes: { body, created, is_by_creator, is_by_patron, vote_sum, deleted_at, reply_count },
    relationships,
  } = comment;

  let commenterInfo = "";
  if (relationships?.commenter && relationships.commenter.data.id) {
    const commenter = included.find((ea) => ea.id == relationships.commenter?.data.id);
    if (commenter && commenter.attributes.full_name) {
      commenterInfo = `
      <div class="flex justify-between items-center mb-2">
      <div class="flex gap-2 items-center">
      <img 
      src="${commenter.attributes.image_url}" 
      alt="${commenter.attributes.full_name}" 
      class="rounded-full w-8 h-8"
      />
      <div class="flex items-center gap-2">
      <span class="text-md text-gray-500">${commenter.attributes.full_name} 
      </span>
      <span class="text-sm flex gap-1">
      ${is_by_creator ? "<i class='fas fa-star text-yellow-400'></i>" : ""}
      ${is_by_patron ? "<i class='fas fa-user text-blue-400'></i>" : ""}
      </span>
      </div>
      </div>
      <p class="text-sm text-gray-500">${new Date(created).toLocaleDateString()}</p>
      </div>
      `;
    }
  }

  let commentBody = `
    <div class="comment mt-4">
      ${commenterInfo}
      <p class="text-lg">${body}</p>
    </div>
    
    <div class="flex justify-between items-center mt-4 text-gray-500">
      <span title="Votes" class="px-2 py-1 hover:bg-gray-600 rounded">
        <i class="fas fa-thumbs-up"></i>
        ${vote_sum}
      </span>
      <span title="Replies" class="px-2 py-1 hover:bg-gray-600 rounded">
        <i class="fas fa-reply"></i>
        ${reply_count}
      </span>
      <span title="Deleted" class="px-2 py-1 hover:bg-gray-600 rounded">
        ${deleted_at ? "<i class='fas fa-trash'></i>" : ""}
      </span>
    </div>
  `;

  // Handle nested replies
  if (relationships?.replies) {
    for (const { id, type } of relationships.replies.data) {
      const reply = type == "comment" && included.find((ea) => ea.id == id);
      if (reply) {
        commentBody += renderComment(reply as Comment, included);
      }
    }
  }

  return commentBody;
}

function titleToId(title: string, i: number): string {
  return title.replace(/[^a-z0-9]/gi, "_").replace(/__+/g, "_") + "_" + i;
}

function main() {
  const { dataDir, patreonUrl } = parseArgs(process.argv.slice(2));

  // Extract creator name from the URL: https://www.patreon.com/creator_name, remove leading and trailing slashes if any
  const name = patreonUrl.split("/").filter(Boolean).pop();

  const htmlFile = `./${dataDir}/${formatDate()}_index.html`;

  let html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${name}'s Archive</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.1/css/all.min.css">
        <script>
            function loadVideo(index) {
                let temp = document.getElementById(\`video-\${index}\`);
                temp.parentNode.appendChild(temp.content.cloneNode(true));
            }
            
            document.addEventListener('DOMContentLoaded', () => {
                const toggleTocButton = document.getElementById('toggle-toc');
                const tocContent = document.getElementById('toc-content');

                toggleTocButton.addEventListener('click', () => {
                    tocContent.classList.toggle('hidden');
                });
            });
        </script>
        <style>
            a {
                color: #3498db;
            }
            a:hover {
                color: #2980b9;
            }
            a:active {
                color: #2980b9;
            }
            a:focus {
                color: #2980b9;
            }
            a:visited {
                color: #3498db;
            }
            
          </style>
    </head>
    <body class="bg-gray-700 text-gray-100 font-sans leading-normal tracking-normal">
        <header>
            <nav class="bg-gray-800 p-4 flex justify-between items-center">
                <span class="text-2xl font-bold">${name}'s Archive</span>
            </nav>
        </header>

        <main class="flex flex-col md:flex-row min-h-screen mx-4 lg:mx-36 my-10">
            <aside class="bg-gray-800 w-full md:w-3/5 py-4 px-4 rounded-2xl mb-6 md:mb-0 md:mr-6">
                <div class="flex justify-between items-center md:block">
                    <h2 class="text-2xl font-bold">Table of Content</h2>
                    <button id="toggle-toc" class="text-gray-500 md:hidden focus:outline-none">
                        <i class="fas fa-list"></i>
                    </button>
                </div>
                <ul id="toc-content" class="p-0 m-0 leading-loose text-lg font-bold hidden md:block mt-4 ml-2"
  `;

  const data: DataEntity[] = JSON.parse(readFileSync(`./${dataDir}/data.json`).toString());

  // Generate Table of Contents
  const toc = data
    .map((post, index) => {
      const { title, published_at } = post.attributes;
      return `<li class="cursor-pointer">
        <a href="#${titleToId(title, index)}" class="text-blue-400 hover:underline">
          ${title} (${published_at.split("T")[0]})
        </a>
      </li>
      <hr class="border-gray-600 my-4">
      `;
    })
    .join("\n");

  html += `${toc}</ul></aside>`;

  // Generate Posts Section
  html += `<section id="posts" class="w-full md:w-3/5">`;

  data.forEach((post, index) => {
    const {
      content,
      title,
      like_count,
      url,
      comment_count,
      published_at,
      post_file,
      embed,
      post_type,
    } = post.attributes;

    html += `
      <article id="${titleToId(title, index)}" class="bg-gray-800 p-4 mb-6 rounded-2xl">
        <header class="mb-4">
          <div class="flex justify-between items-center">
            <h2 class="text-2xl font-bold">${title}</h2>
            <a href="${url}" class="flex text-gray-500 hover:text-gray-300 items-center" 
            target="_blank">
              Open
              <i class="fa-solid fa-arrow-up-right-from-square ml-2"></i>
            </a>
          </div>
          <p class="text-sm text-gray-500">${new Date(published_at).toLocaleDateString()}</p>
        </header>
        
        ${post_file ? renderPostFile(post_file) : ""}
        ${embed ? renderEmbed(embed, post_type, index) : ""}
        
        <p class="text-lg mb-4">${content}</p>
        
        <div class="mb-4 text-gray-500">
          <span
          title="Likes"
          >
          <i class="fas fa-heart"></i>
          ${like_count}</span>
          <span class="ml-4"
          title="Comments"
          >
          <i class="fas fa-comment"></i>
          ${comment_count}</span>
        </div>
        
        
        
        ${
          post.comments && post.comments.data?.length
            ? `
          <section id="post-comments">
            <h3 class="text-xl font-bold">Comments</h3>
            ${post.comments.data
              .map((comment) => renderComment(comment, post.comments?.included ?? []))
              .join("<hr class='border-gray-600 my-4'>")}
          </section>
        `
            : ""
        }
      </article>
    `;
  });

  html += `
        </section>
      </main>
      
      <footer class="bg-gray-800 p-4 text-center">
        <p class="text-sm text-gray-500">Patreon Archive &copy; ${new Date().getFullYear()}</p>
        <a href="#"
          class="fixed bottom-4 right-4 bg-gray-800 p-3 rounded-full text-gray-500 hover:text-gray-100 border-2 border-gray-500 focus:outline-none"
          aria-label="Back to top">
          <i class="fas fa-arrow-up"></i>
        </a>
      </footer>
    </body>
    </html>
  `;

  writeFileSync(htmlFile, html);
  console.log(`file://${resolve(htmlFile)}`);
}

main();
