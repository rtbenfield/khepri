<script>
	let count = 0;

	function handleClick() {
		count += 1;
	}
</script>

<style>
	button {
		color: purple;
		font-family: 'Comic Sans MS', cursive;
		font-size: 2em;
	}
</style>

<button on:click={handleClick}>
	Clicked {count} {count === 1 ? 'time' : 'times'}
</button>